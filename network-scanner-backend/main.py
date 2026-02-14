import asyncio
import socket
import time
import ipaddress
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Network Inspection Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

MAX_PORT_RANGE = 1024
MAX_TIMEOUT_MS = 5000
MAX_CONCURRENT = 100

class ScanRequest(BaseModel):
    host: str = Field(..., min_length=1, max_length=255)
    startPort: int = Field(..., ge=1, le=65535)
    endPort: int = Field(..., ge=1, le=65535)
    timeoutMs: int = Field(..., ge=100, le=MAX_TIMEOUT_MS)

    @validator('host')
    def validate_host(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Host cannot be empty")
        return v

    @validator('endPort')
    def validate_port_range(cls, v, values):
        if 'startPort' in values and v < values['startPort']:
            raise ValueError("endPort must be >= startPort")
        if 'startPort' in values and (v - values['startPort']) > MAX_PORT_RANGE:
            raise ValueError(f"Port range cannot exceed {MAX_PORT_RANGE}")
        return v

class PortResult(BaseModel):
    port: int
    status: str
    latencyMs: Optional[float]

class ScanResponse(BaseModel):
    host: str
    resolvedIp: str
    scanSummary: Dict
    results: List[PortResult]

def is_private_ip(ip: str) -> bool:
    """Check if IP is private/localhost"""
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_reserved
    except ValueError:
        return False

async def resolve_host(host: str) -> str:
    """Resolve hostname to IP with SSRF protection"""
    try:
        loop = asyncio.get_event_loop()
        ip = await loop.run_in_executor(None, socket.gethostbyname, host)
        
        if is_private_ip(ip):
            raise ValueError(f"Cannot scan private/internal IP: {ip}")
        
        logger.info(f"Resolved {host} to {ip}")
        return ip
    except socket.gaierror:
        raise ValueError(f"Cannot resolve hostname: {host}")

async def scan_port(ip: str, port: int, timeout: float, semaphore: asyncio.Semaphore) -> PortResult:
    """Scan single port with concurrency control"""
    async with semaphore:
        start = time.time()
        try:
            conn = asyncio.open_connection(ip, port)
            reader, writer = await asyncio.wait_for(conn, timeout=timeout)
            writer.close()
            await writer.wait_closed()
            latency = (time.time() - start) * 1000
            return PortResult(port=port, status="open", latencyMs=round(latency, 2))
        except asyncio.TimeoutError:
            return PortResult(port=port, status="timeout", latencyMs=None)
        except (ConnectionRefusedError, OSError):
            return PortResult(port=port, status="closed", latencyMs=None)

async def scan_ports(ip: str, start_port: int, end_port: int, timeout_ms: int) -> List[PortResult]:
    """Scan port range with bounded concurrency"""
    timeout = timeout_ms / 1000.0
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    
    tasks = [
        scan_port(ip, port, timeout, semaphore)
        for port in range(start_port, end_port + 1)
    ]
    
    results = await asyncio.gather(*tasks)
    return list(results)

@app.post("/scan", response_model=ScanResponse)
async def scan_endpoint(request: ScanRequest):
    """TCP port scanner endpoint"""
    logger.info(f"Scan request: {request.host} ports {request.startPort}-{request.endPort}")
    
    try:
        ip = await resolve_host(request.host)
        results = await scan_ports(ip, request.startPort, request.endPort, request.timeoutMs)
        
        open_ports = [r for r in results if r.status == "open"]
        closed_ports = [r for r in results if r.status == "closed"]
        
        latencies = [r.latencyMs for r in results if r.latencyMs is not None]
        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        
        summary = {
            "totalPorts": len(results),
            "openPorts": len(open_ports),
            "closedPorts": len(closed_ports),
            "avgLatencyMs": round(avg_latency, 2)
        }
        
        logger.info(f"Scan complete: {len(open_ports)} open ports found")
        
        return ScanResponse(
            host=request.host,
            resolvedIp=ip,
            scanSummary=summary,
            results=results
        )
    
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Scan error: {str(e)}")
        raise HTTPException(status_code=500, detail="Scan failed")

@app.get("/health")
async def health():
    return {"status": "healthy"}

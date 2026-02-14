import asyncio
import random
import time
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Microservice Health Simulator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ServiceMetrics(BaseModel):
    service_id: str
    status: str
    latency_ms: float
    error_rate: float
    success_rate: float
    uptime: float
    total_requests: int
    failed_requests: int

class ServiceGraph(BaseModel):
    services: List[ServiceMetrics]
    dependencies: Dict[str, List[str]]

class FailureRequest(BaseModel):
    service_id: str
    duration_seconds: int = 30

class MicroserviceSimulator:
    def __init__(self):
        self.services = {
            "api-gateway": {"deps": ["auth-service", "user-service"], "error_prob": 0.02},
            "auth-service": {"deps": ["db-service"], "error_prob": 0.03},
            "user-service": {"deps": ["db-service", "cache-service"], "error_prob": 0.04},
            "order-service": {"deps": ["payment-service", "inventory-service"], "error_prob": 0.05},
            "payment-service": {"deps": ["db-service"], "error_prob": 0.06},
            "inventory-service": {"deps": ["db-service", "cache-service"], "error_prob": 0.04},
            "notification-service": {"deps": [], "error_prob": 0.03},
            "db-service": {"deps": [], "error_prob": 0.02},
            "cache-service": {"deps": [], "error_prob": 0.03},
        }
        self.metrics = {sid: {"latency": [], "errors": 0, "success": 0, "start_time": time.time(), "forced_failure": None} 
                       for sid in self.services}
        self.lock = asyncio.Lock()
        self.running = False

    async def simulate_service_call(self, service_id: str) -> tuple[bool, float]:
        """Simulate a service call with latency and potential failure"""
        base_latency = random.uniform(10, 100)
        
        async with self.lock:
            if self.metrics[service_id]["forced_failure"]:
                if time.time() < self.metrics[service_id]["forced_failure"]:
                    return False, base_latency * 3
                else:
                    self.metrics[service_id]["forced_failure"] = None
        
        error_prob = self.services[service_id]["error_prob"]
        success = random.random() > error_prob
        
        latency = base_latency if success else base_latency * 2
        await asyncio.sleep(latency / 1000)
        
        async with self.lock:
            self.metrics[service_id]["latency"].append(latency)
            if len(self.metrics[service_id]["latency"]) > 100:
                self.metrics[service_id]["latency"].pop(0)
            
            if success:
                self.metrics[service_id]["success"] += 1
            else:
                self.metrics[service_id]["errors"] += 1
        
        return success, latency

    async def simulate_request_flow(self, service_id: str):
        """Simulate request through service and its dependencies"""
        success, latency = await self.simulate_service_call(service_id)
        
        if success:
            for dep in self.services[service_id]["deps"]:
                dep_success, _ = await self.simulate_service_call(dep)
                if not dep_success:
                    async with self.lock:
                        self.metrics[service_id]["errors"] += 1
                        self.metrics[service_id]["success"] -= 1
                    break

    async def run_simulation(self):
        """Main simulation loop"""
        self.running = True
        while self.running:
            tasks = []
            for service_id in self.services:
                if random.random() < 0.3:
                    tasks.append(self.simulate_request_flow(service_id))
            
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            
            await asyncio.sleep(0.5)

    async def get_metrics(self) -> ServiceGraph:
        """Get current metrics for all services"""
        async with self.lock:
            services = []
            for sid, data in self.metrics.items():
                total = data["success"] + data["errors"]
                latencies = data["latency"]
                uptime = time.time() - data["start_time"]
                
                avg_latency = sum(latencies) / len(latencies) if latencies else 0
                error_rate = (data["errors"] / total * 100) if total > 0 else 0
                success_rate = (data["success"] / total * 100) if total > 0 else 100
                
                if data["forced_failure"] and time.time() < data["forced_failure"]:
                    status = "failing"
                elif error_rate > 20:
                    status = "degraded"
                else:
                    status = "healthy"
                
                services.append(ServiceMetrics(
                    service_id=sid,
                    status=status,
                    latency_ms=round(avg_latency, 2),
                    error_rate=round(error_rate, 2),
                    success_rate=round(success_rate, 2),
                    uptime=round(uptime, 2),
                    total_requests=total,
                    failed_requests=data["errors"]
                ))
            
            dependencies = {sid: self.services[sid]["deps"] for sid in self.services}
            return ServiceGraph(services=services, dependencies=dependencies)

    async def force_failure(self, service_id: str, duration: int):
        """Force a service to fail for a duration"""
        if service_id not in self.services:
            raise ValueError(f"Service {service_id} not found")
        
        async with self.lock:
            self.metrics[service_id]["forced_failure"] = time.time() + duration
        
        logger.info(f"Forced failure on {service_id} for {duration}s")

simulator = MicroserviceSimulator()

@app.on_event("startup")
async def startup():
    asyncio.create_task(simulator.run_simulation())
    logger.info("Microservice simulator started")

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/services", response_model=ServiceGraph)
async def get_services():
    return await simulator.get_metrics()

@app.get("/metrics")
async def get_metrics():
    graph = await simulator.get_metrics()
    total_requests = sum(s.total_requests for s in graph.services)
    total_errors = sum(s.failed_requests for s in graph.services)
    avg_latency = sum(s.latency_ms for s in graph.services) / len(graph.services)
    
    return {
        "total_requests": total_requests,
        "total_errors": total_errors,
        "avg_latency_ms": round(avg_latency, 2),
        "services_count": len(graph.services),
        "healthy_services": len([s for s in graph.services if s.status == "healthy"]),
        "degraded_services": len([s for s in graph.services if s.status == "degraded"]),
        "failing_services": len([s for s in graph.services if s.status == "failing"])
    }

@app.post("/simulate-failure")
async def simulate_failure(request: FailureRequest):
    try:
        await simulator.force_failure(request.service_id, request.duration_seconds)
        return {"message": f"Failure simulated on {request.service_id} for {request.duration_seconds}s"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket client connected")
    
    try:
        while True:
            graph = await simulator.get_metrics()
            await websocket.send_json(graph.dict())
            await asyncio.sleep(2)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        logger.info("WebSocket client disconnected")

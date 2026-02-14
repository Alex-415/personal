package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/rs/cors"
)

type ServiceMetrics struct {
	ServiceID      string  `json:"service_id"`
	Status         string  `json:"status"`
	LatencyMs      float64 `json:"latency_ms"`
	ErrorRate      float64 `json:"error_rate"`
	SuccessRate    float64 `json:"success_rate"`
	Uptime         float64 `json:"uptime"`
	TotalRequests  int     `json:"total_requests"`
	FailedRequests int     `json:"failed_requests"`
}

type ServiceGraph struct {
	Services     []ServiceMetrics       `json:"services"`
	Dependencies map[string][]string    `json:"dependencies"`
}

type FailureRequest struct {
	ServiceID       string `json:"service_id"`
	DurationSeconds int    `json:"duration_seconds"`
}

type ServiceConfig struct {
	Deps      []string
	ErrorProb float64
}

type ServiceData struct {
	Latencies     []float64
	Errors        int
	Success       int
	StartTime     time.Time
	ForcedFailure *time.Time
}

type Simulator struct {
	services map[string]ServiceConfig
	metrics  map[string]*ServiceData
	mu       sync.RWMutex
	running  bool
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func NewSimulator() *Simulator {
	services := map[string]ServiceConfig{
		"api-gateway":          {Deps: []string{"auth-service", "user-service"}, ErrorProb: 0.02},
		"auth-service":         {Deps: []string{"db-service"}, ErrorProb: 0.03},
		"user-service":         {Deps: []string{"db-service"}, ErrorProb: 0.04},
		"order-service":        {Deps: []string{"payment-service"}, ErrorProb: 0.05},
		"payment-service":      {Deps: []string{}, ErrorProb: 0.06},
		"db-service":           {Deps: []string{}, ErrorProb: 0.02},
	}

	metrics := make(map[string]*ServiceData)
	for sid := range services {
		metrics[sid] = &ServiceData{
			Latencies: []float64{},
			StartTime: time.Now(),
		}
	}

	return &Simulator{
		services: services,
		metrics:  metrics,
		running:  false,
	}
}

func (s *Simulator) simulateServiceCall(serviceID string) (bool, float64) {
	baseLatency := 10.0 + rand.Float64()*90.0

	s.mu.Lock()
	data := s.metrics[serviceID]
	if data.ForcedFailure != nil && time.Now().Before(*data.ForcedFailure) {
		s.mu.Unlock()
		return false, baseLatency * 3
	}
	s.mu.Unlock()

	errorProb := s.services[serviceID].ErrorProb
	success := rand.Float64() > errorProb

	latency := baseLatency
	if !success {
		latency = baseLatency * 2
	}

	time.Sleep(time.Duration(latency) * time.Millisecond)

	s.mu.Lock()
	data.Latencies = append(data.Latencies, latency)
	if len(data.Latencies) > 100 {
		data.Latencies = data.Latencies[1:]
	}
	if success {
		data.Success++
	} else {
		data.Errors++
	}
	s.mu.Unlock()

	return success, latency
}

func (s *Simulator) simulateRequestFlow(serviceID string) {
	success, _ := s.simulateServiceCall(serviceID)

	if success {
		for _, dep := range s.services[serviceID].Deps {
			depSuccess, _ := s.simulateServiceCall(dep)
			if !depSuccess {
				s.mu.Lock()
				s.metrics[serviceID].Errors++
				s.metrics[serviceID].Success--
				s.mu.Unlock()
				break
			}
		}
	}
}

func (s *Simulator) runSimulation() {
	s.running = true
	for s.running {
		for serviceID := range s.services {
			if rand.Float64() < 0.3 {
				go s.simulateRequestFlow(serviceID)
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
}

func (s *Simulator) getMetrics() ServiceGraph {
	s.mu.RLock()
	defer s.mu.RUnlock()

	services := []ServiceMetrics{}
	for sid, data := range s.metrics {
		total := data.Success + data.Errors
		avgLatency := 0.0
		if len(data.Latencies) > 0 {
			sum := 0.0
			for _, l := range data.Latencies {
				sum += l
			}
			avgLatency = sum / float64(len(data.Latencies))
		}

		errorRate := 0.0
		successRate := 100.0
		if total > 0 {
			errorRate = float64(data.Errors) / float64(total) * 100
			successRate = float64(data.Success) / float64(total) * 100
		}

		status := "healthy"
		if data.ForcedFailure != nil && time.Now().Before(*data.ForcedFailure) {
			status = "failing"
		} else if errorRate > 20 {
			status = "degraded"
		}

		uptime := time.Since(data.StartTime).Seconds()

		services = append(services, ServiceMetrics{
			ServiceID:      sid,
			Status:         status,
			LatencyMs:      round(avgLatency, 2),
			ErrorRate:      round(errorRate, 2),
			SuccessRate:    round(successRate, 2),
			Uptime:         round(uptime, 2),
			TotalRequests:  total,
			FailedRequests: data.Errors,
		})
	}

	dependencies := make(map[string][]string)
	for sid, cfg := range s.services {
		dependencies[sid] = cfg.Deps
	}

	return ServiceGraph{
		Services:     services,
		Dependencies: dependencies,
	}
}

func (s *Simulator) forceFailure(serviceID string, duration int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, exists := s.metrics[serviceID]
	if !exists {
		return http.ErrNotSupported
	}

	failUntil := time.Now().Add(time.Duration(duration) * time.Second)
	data.ForcedFailure = &failUntil
	log.Printf("Forced failure on %s for %ds", serviceID, duration)
	return nil
}

func round(val float64, precision int) float64 {
	ratio := 1.0
	for i := 0; i < precision; i++ {
		ratio *= 10
	}
	return float64(int(val*ratio+0.5)) / ratio
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("[%s] %s %s", r.Method, r.URL.Path, r.RemoteAddr)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func (s *Simulator) servicesHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("[%s] %s %s", r.Method, r.URL.Path, r.RemoteAddr)
	w.Header().Set("Content-Type", "application/json")
	graph := s.getMetrics()
	json.NewEncoder(w).Encode(graph)
}

func (s *Simulator) metricsHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("[%s] %s %s", r.Method, r.URL.Path, r.RemoteAddr)
	graph := s.getMetrics()
	
	totalRequests := 0
	totalErrors := 0
	totalLatency := 0.0
	healthy := 0
	degraded := 0
	failing := 0

	for _, svc := range graph.Services {
		totalRequests += svc.TotalRequests
		totalErrors += svc.FailedRequests
		totalLatency += svc.LatencyMs
		switch svc.Status {
		case "healthy":
			healthy++
		case "degraded":
			degraded++
		case "failing":
			failing++
		}
	}

	avgLatency := 0.0
	if len(graph.Services) > 0 {
		avgLatency = totalLatency / float64(len(graph.Services))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_requests":     totalRequests,
		"total_errors":       totalErrors,
		"avg_latency_ms":     round(avgLatency, 2),
		"services_count":     len(graph.Services),
		"healthy_services":   healthy,
		"degraded_services":  degraded,
		"failing_services":   failing,
	})
}

func (s *Simulator) simulateFailureHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("[%s] %s %s", r.Method, r.URL.Path, r.RemoteAddr)
	var req FailureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := s.forceFailure(req.ServiceID, req.DurationSeconds); err != nil {
		http.Error(w, "Service not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Failure simulated on " + req.ServiceID,
	})
}

func (s *Simulator) websocketHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}
	defer conn.Close()

	log.Println("WebSocket client connected")

	for {
		graph := s.getMetrics()
		if err := conn.WriteJSON(graph); err != nil {
			log.Println("WebSocket write error:", err)
			break
		}
		time.Sleep(2 * time.Second)
	}

	log.Println("WebSocket client disconnected")
}

func main() {
	rand.Seed(time.Now().UnixNano())

	simulator := NewSimulator()
	go simulator.runSimulation()

	r := mux.NewRouter()
	r.HandleFunc("/health", healthHandler).Methods("GET")
	r.HandleFunc("/services", simulator.servicesHandler).Methods("GET")
	r.HandleFunc("/metrics", simulator.metricsHandler).Methods("GET")
	r.HandleFunc("/simulate-failure", simulator.simulateFailureHandler).Methods("POST")
	r.HandleFunc("/ws", simulator.websocketHandler)

	handler := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	}).Handler(r)

	port := "10000"
	log.Printf("Server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

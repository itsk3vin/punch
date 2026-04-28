package handler

import (
	"log/slog"
	"net/http"
)

func Register(mux *http.ServeMux, logger *slog.Logger) {
	mux.HandleFunc("GET /health", health())
	mux.HandleFunc("GET /api/v1/", notFound())
}

func notFound() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}
}

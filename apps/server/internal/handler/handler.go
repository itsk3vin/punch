package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"punch/server/internal/middleware"
)

func Register(mux *http.ServeMux, logger *slog.Logger, auth *middleware.Auth0) {
	mux.HandleFunc("GET /health", health())
	mux.Handle("GET /api/v1/private", auth.RequireAuth(private()))
	mux.HandleFunc("GET /api/v1/", notFound())
}

func private() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims := middleware.Claims(r.Context())

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"message": "You called a protected endpoint.",
			"subject": claims["sub"],
		})
	}
}

func notFound() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}
}

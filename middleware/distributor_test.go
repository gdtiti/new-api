package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGetModelRequestSkipsResponsesWebSocketUpgrade(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest("GET", "/v1/responses", nil)
	req.Header.Set("Upgrade", "websocket")
	ctx.Request = req

	modelRequest, shouldSelectChannel, err := getModelRequest(ctx)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if shouldSelectChannel {
		t.Fatalf("expected distributor to skip early channel selection for responses websocket")
	}
	if modelRequest == nil {
		t.Fatalf("expected model request")
	}
	if modelRequest.Model != "" {
		t.Fatalf("expected empty model before websocket first frame, got %q", modelRequest.Model)
	}
}

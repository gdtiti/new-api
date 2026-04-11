package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
)

func TestShouldRestrictOpenAIUpstreamByRequestPath(t *testing.T) {
	globalSettings := model_setting.GetGlobalSettings()
	original := globalSettings.OpenAIDownstreamStrictUpstreamEnabled
	t.Cleanup(func() {
		globalSettings.OpenAIDownstreamStrictUpstreamEnabled = original
	})

	globalSettings.OpenAIDownstreamStrictUpstreamEnabled = false
	assert.False(t, ShouldRestrictOpenAIUpstreamByRequestPath("/v1/chat/completions"))
	assert.False(t, ShouldRestrictOpenAIUpstreamByRequestPath("/v1/responses"))
	assert.False(t, ShouldRestrictOpenAIUpstreamByRequestPath("/v1/responses/compact"))
	assert.False(t, ShouldRestrictOpenAIUpstreamByRequestPath("/v1/embeddings"))

	globalSettings.OpenAIDownstreamStrictUpstreamEnabled = true
	assert.True(t, ShouldRestrictOpenAIUpstreamByRequestPath("/v1/chat/completions"))
	assert.True(t, ShouldRestrictOpenAIUpstreamByRequestPath("/v1/responses"))
	assert.True(t, ShouldRestrictOpenAIUpstreamByRequestPath("/v1/responses/compact"))
	assert.True(t, ShouldRestrictOpenAIUpstreamByRequestPath("/v1/responses/compact/foo"))
	assert.False(t, ShouldRestrictOpenAIUpstreamByRequestPath("/v1/embeddings"))
}

func TestIsAPITypeAllowedForRelayFormat(t *testing.T) {
	globalSettings := model_setting.GetGlobalSettings()
	original := globalSettings.OpenAIDownstreamStrictUpstreamEnabled
	t.Cleanup(func() {
		globalSettings.OpenAIDownstreamStrictUpstreamEnabled = original
	})

	globalSettings.OpenAIDownstreamStrictUpstreamEnabled = false
	assert.True(t, IsAPITypeAllowedForRelayFormat(constant.APITypeAnthropic, types.RelayFormatOpenAI))
	assert.True(t, IsAPITypeAllowedForRelayFormat(constant.APITypeAnthropic, types.RelayFormatOpenAIResponses))
	assert.False(t, IsAPITypeAllowedForRelayFormat(constant.APITypeAnthropic, types.RelayFormatOpenAIResponsesCompaction))
	assert.True(t, IsAPITypeAllowedForRelayFormat(constant.APITypeOpenAI, types.RelayFormatOpenAIResponsesCompaction))

	globalSettings.OpenAIDownstreamStrictUpstreamEnabled = true
	assert.False(t, IsAPITypeAllowedForRelayFormat(constant.APITypeAnthropic, types.RelayFormatOpenAI))
	assert.False(t, IsAPITypeAllowedForRelayFormat(constant.APITypeAnthropic, types.RelayFormatOpenAIResponses))
	assert.True(t, IsAPITypeAllowedForRelayFormat(constant.APITypeCodex, types.RelayFormatOpenAIResponses))
	assert.True(t, IsAPITypeAllowedForRelayFormat(constant.APITypeGemini, types.RelayFormatGemini))
}

func TestIsAllowedOpenAIUpstreamChannelType(t *testing.T) {
	assert.True(t, IsAllowedOpenAIUpstreamChannelType(constant.ChannelTypeOpenAI))
	assert.True(t, IsAllowedOpenAIUpstreamChannelType(constant.ChannelTypeCodex))
	assert.False(t, IsAllowedOpenAIUpstreamChannelType(constant.ChannelTypeAnthropic))
	assert.False(t, IsAllowedOpenAIUpstreamChannelType(constant.ChannelTypeGemini))
}

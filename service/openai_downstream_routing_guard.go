package service

import (
	"github.com/QuantumNous/new-api/service/openaicompat"
	"github.com/QuantumNous/new-api/types"
)

func ShouldRestrictOpenAIUpstreamByRequestPath(requestPath string) bool {
	return openaicompat.ShouldRestrictOpenAIUpstreamByRequestPath(requestPath)
}

func IsAllowedOpenAIUpstreamChannelType(channelType int) bool {
	return openaicompat.IsAllowedOpenAIUpstreamChannelType(channelType)
}

func IsChannelTypeAllowedForRequestPath(channelType int, requestPath string) bool {
	return openaicompat.IsChannelTypeAllowedForRequestPath(channelType, requestPath)
}

func IsAPITypeAllowedForRelayFormat(apiType int, relayFormat types.RelayFormat) bool {
	return openaicompat.IsAPITypeAllowedForRelayFormat(apiType, relayFormat)
}

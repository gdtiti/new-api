/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import { useCallback, useState } from 'react';
import { API, showError } from '../../helpers';

const EMPTY_ANALYTICS = {
  dimension: '',
  filter: {},
  summary: {
    total_requests: 0,
    success_requests: 0,
    error_requests: 0,
    success_rate_percent: 0,
    avg_latency_seconds: 0,
    p95_latency_seconds: 0,
    peak_estimated_concurrency: 0,
    stability_score: 0,
  },
  trend: [],
  ranking: [],
};

const toUnixTimestamp = (value) => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 0;
  }
  return Math.floor(timestamp / 1000);
};

export const useQualityAnalytics = (
  inputs,
  dataExportDefaultTime,
  isAdminUser,
) => {
  const [loading, setLoading] = useState(false);
  const [channelAnalytics, setChannelAnalytics] = useState(EMPTY_ANALYTICS);
  const [modelAnalytics, setModelAnalytics] = useState(EMPTY_ANALYTICS);

  const loadAnalytics = useCallback(async () => {
    if (!isAdminUser) {
      return;
    }

    setLoading(true);
    try {
      const startTimestamp = toUnixTimestamp(inputs.start_timestamp);
      const endTimestamp = toUnixTimestamp(inputs.end_timestamp);
      const searchParams = new URLSearchParams({
        start_timestamp: String(startTimestamp),
        end_timestamp: String(endTimestamp),
        default_time: dataExportDefaultTime || 'day',
      });

      if (inputs.username) {
        searchParams.set('username', inputs.username);
      }

      const [channelRes, modelRes] = await Promise.all([
        API.get(`/api/log/analytics/channel?${searchParams.toString()}`),
        API.get(`/api/log/analytics/model?${searchParams.toString()}`),
      ]);

      const channelData = channelRes?.data || {};
      const modelData = modelRes?.data || {};

      if (!channelData.success) {
        showError(channelData.message || '加载渠道分析失败');
      } else {
        setChannelAnalytics(channelData.data || EMPTY_ANALYTICS);
      }

      if (!modelData.success) {
        showError(modelData.message || '加载模型分析失败');
      } else {
        setModelAnalytics(modelData.data || EMPTY_ANALYTICS);
      }
    } catch (error) {
      showError(error?.message || '加载分析数据失败');
    } finally {
      setLoading(false);
    }
  }, [dataExportDefaultTime, inputs.end_timestamp, inputs.start_timestamp, inputs.username, isAdminUser]);

  return {
    analyticsLoading: loading,
    channelAnalytics,
    modelAnalytics,
    loadAnalytics,
  };
};

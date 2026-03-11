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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  API,
  renderNumber,
  renderQuota,
  showError,
  timestamp2string,
  toLocalUnixTimestamp,
} from '../../helpers';
import { TIME_OPTIONS } from '../../constants';
import { useDashboardCharts } from '../dashboard/useDashboardCharts';

const PRESET_OPTIONS = [
  { key: '24h', label: '24h', seconds: 24 * 60 * 60 },
  { key: '7d', label: '7d', seconds: 7 * 24 * 60 * 60 },
  { key: '30d', label: '30d', seconds: 30 * 24 * 60 * 60 },
];

const EMPTY_TREND_DATA = {
  balance: [],
  usedQuota: [],
  requestCount: [],
  times: [],
  consumeQuota: [],
  tokens: [],
  rpm: [],
  tpm: [],
};

const formatDateRange = (range) => {
  if (!Array.isArray(range) || range.length !== 2) {
    return [
      timestamp2string(Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60),
      timestamp2string(Math.floor(Date.now() / 1000)),
    ];
  }
  return range;
};

const toUnixSeconds = (value) => {
  if (!value) {
    return 0;
  }
  return toLocalUnixTimestamp(value);
};

const buildDateRangeFromPreset = (preset) => {
  const option =
    PRESET_OPTIONS.find((item) => item.key === preset) || PRESET_OPTIONS[2];
  const end = Math.floor(Date.now() / 1000);
  const start = end - option.seconds;
  return [timestamp2string(start), timestamp2string(end)];
};

const buildActiveWindowLabel = (preset, t) => {
  const matched = PRESET_OPTIONS.find((item) => item.key === preset);
  return matched?.label || t('自定义');
};

export const usePortalModelGalleryData = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [user, setUser] = useState(null);
  const [quotaData, setQuotaData] = useState([]);
  const [consumeQuota, setConsumeQuota] = useState(0);
  const [times, setTimes] = useState(0);
  const [consumeTokens, setConsumeTokens] = useState(0);
  const [trendData, setTrendData] = useState(EMPTY_TREND_DATA);
  const [pieData, setPieData] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [modelColors, setModelColors] = useState({});

  const initialPreset = searchParams.get('preset') || '30d';
  const initialDefaultTime = searchParams.get('default_time') || 'day';
  const [preset, setPreset] = useState(initialPreset);
  const [defaultTime, setDefaultTime] = useState(initialDefaultTime);
  const [dateRange, setDateRange] = useState(() => {
    const start = searchParams.get('start_timestamp');
    const end = searchParams.get('end_timestamp');
    if (start && end) {
      return [start, end];
    }
    return buildDateRangeFromPreset(initialPreset);
  });

  const dashboardCharts = useDashboardCharts(
    defaultTime,
    setTrendData,
    setConsumeQuota,
    setTimes,
    setConsumeTokens,
    setPieData,
    setLineData,
    setModelColors,
    t,
  );

  const syncSearchParams = useCallback(
    (nextPreset, nextDateRange, nextDefaultTime) => {
      const next = new URLSearchParams(searchParams);
      next.set('preset', nextPreset);
      next.set('default_time', nextDefaultTime);
      next.set('start_timestamp', nextDateRange[0]);
      next.set('end_timestamp', nextDateRange[1]);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const loadGalleryData = useCallback(
    async (currentDateRange = dateRange, currentDefaultTime = defaultTime) => {
      setRefreshing(true);
      try {
        setErrorMessage('');
        const [userRes, quotaRes] = await Promise.all([
          API.get('/api/user/self'),
          API.get(
            encodeURI(
              `/api/data/self?default_time=${currentDefaultTime}&start_timestamp=${toUnixSeconds(currentDateRange[0])}&end_timestamp=${toUnixSeconds(currentDateRange[1])}`,
            ),
          ),
        ]);

        const failed = [userRes, quotaRes].find(
          (response) => response?.data?.success === false,
        );
        if (failed) {
          const message = failed.data?.message || t('获取模型广场数据失败');
          setErrorMessage(message);
          showError(message);
          return;
        }

        setUser(userRes.data?.data || null);
        const nextQuotaData = quotaRes.data?.data || [];
        setQuotaData(nextQuotaData);
        dashboardCharts.updateChartData(nextQuotaData);
      } catch (error) {
        const message = error?.message || t('获取模型广场数据失败');
        setErrorMessage(message);
        showError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dashboardCharts, dateRange, defaultTime, t],
  );

  useEffect(() => {
    loadGalleryData(dateRange, defaultTime).then();
  }, []);

  const handlePresetChange = useCallback(
    (nextPreset) => {
      const nextDateRange = buildDateRangeFromPreset(nextPreset);
      setPreset(nextPreset);
      setDateRange(nextDateRange);
      syncSearchParams(nextPreset, nextDateRange, defaultTime);
    },
    [defaultTime, syncSearchParams],
  );

  const handleDateRangeChange = useCallback(
    (nextDateRange) => {
      const normalized = formatDateRange(nextDateRange);
      setPreset('custom');
      setDateRange(normalized);
      syncSearchParams('custom', normalized, defaultTime);
    },
    [defaultTime, syncSearchParams],
  );

  const handleDefaultTimeChange = useCallback(
    (value) => {
      setDefaultTime(value);
      syncSearchParams(preset, dateRange, value);
    },
    [dateRange, preset, syncSearchParams],
  );

  const handleRefresh = useCallback(async () => {
    await loadGalleryData(dateRange, defaultTime);
  }, [dateRange, defaultTime, loadGalleryData]);

  const quotaRanking = useMemo(() => {
    return [...pieData]
      .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
      .slice(0, 5);
  }, [pieData]);

  const requestRanking = useMemo(() => {
    return [...(dashboardCharts.spec_rank_bar?.data?.[0]?.values || [])]
      .sort((a, b) => Number(b.Count || 0) - Number(a.Count || 0))
      .slice(0, 5);
  }, [dashboardCharts.spec_rank_bar]);

  const topQuotaModel = quotaRanking[0]?.type || '';
  const topRequestModel = requestRanking[0]?.Model || '';
  const activeWindowLabel = buildActiveWindowLabel(preset, t);

  const buildLogPath = useCallback(
    (extra = {}) => {
      const next = new URLSearchParams();
      next.set('tab', 'api');
      next.set('start_timestamp', dateRange[0]);
      next.set('end_timestamp', dateRange[1]);
      if (extra.model_name) {
        next.set('model_name', extra.model_name);
      }
      if (extra.token_name) {
        next.set('token_name', extra.token_name);
      }
      if (extra.group) {
        next.set('group', extra.group);
      }
      if (extra.request_id) {
        next.set('request_id', extra.request_id);
      }
      if (extra.logType !== undefined && extra.logType !== null) {
        next.set('logType', `${extra.logType}`);
      }
      return `/app/logs?${next.toString()}`;
    },
    [dateRange],
  );

  const buildModelPath = useCallback(
    (modelName) => {
      const next = new URLSearchParams();
      next.set('preset', preset);
      next.set('default_time', defaultTime);
      next.set('start_timestamp', dateRange[0]);
      next.set('end_timestamp', dateRange[1]);
      if (modelName) {
        next.set('model', modelName);
        next.set('q', modelName);
      }
      return `/app/models?${next.toString()}`;
    },
    [dateRange, defaultTime, preset],
  );

  const navigateToLogs = useCallback(
    (extra) => navigate(buildLogPath(extra)),
    [buildLogPath, navigate],
  );
  const navigateToModel = useCallback(
    (modelName) => navigate(buildModelPath(modelName)),
    [buildModelPath, navigate],
  );
  const navigateToAnalytics = useCallback(
    () =>
      navigate(
        `/app/analytics?${new URLSearchParams({
          preset,
          default_time: defaultTime,
          start_timestamp: dateRange[0],
          end_timestamp: dateRange[1],
        }).toString()}`,
      ),
    [dateRange, defaultTime, navigate, preset],
  );

  const favoriteModels = useMemo(() => {
    return requestRanking
      .map((item, index) => {
        const modelName = item?.Model;
        if (!modelName) {
          return null;
        }
        return {
          key: `${modelName}-${index}`,
          modelName,
          value: renderNumber(item?.Count || 0),
          description: t('当前窗口调用 {{count}} 次', {
            count: renderNumber(item?.Count || 0),
          }),
          onOpenModel: () => navigateToModel(modelName),
          onOpenLogs: () => navigateToLogs({ model_name: modelName }),
        };
      })
      .filter(Boolean);
  }, [navigateToLogs, navigateToModel, requestRanking, t]);

  const consumptionModels = useMemo(() => {
    return quotaRanking
      .map((item, index) => {
        const modelName = item?.type;
        if (!modelName) {
          return null;
        }
        return {
          key: `${modelName}-${index}`,
          modelName,
          value: renderQuota(Number(item?.value || 0), 2),
          description: t('当前窗口累计消耗 {{quota}}', {
            quota: renderQuota(Number(item?.value || 0), 2),
          }),
          onOpenModel: () => navigateToModel(modelName),
          onOpenLogs: () => navigateToLogs({ model_name: modelName }),
        };
      })
      .filter(Boolean);
  }, [navigateToLogs, navigateToModel, quotaRanking, t]);

  const activeModelCount = useMemo(() => {
    const names = new Set();
    requestRanking.forEach((item) => {
      if (item?.Model) {
        names.add(item.Model);
      }
    });
    quotaRanking.forEach((item) => {
      if (item?.type) {
        names.add(item.type);
      }
    });
    return names.size;
  }, [quotaRanking, requestRanking]);

  const metricCards = useMemo(
    () => [
      {
        key: 'top-request',
        label: t('近期高频模型'),
        value: topRequestModel || t('暂无数据'),
        hint: requestRanking[0]
          ? t('调用 {{count}} 次', {
              count: renderNumber(requestRanking[0]?.Count || 0),
            })
          : t('切换时间窗口后查看常用模型'),
      },
      {
        key: 'top-quota',
        label: t('近期高消耗模型'),
        value: topQuotaModel || t('暂无数据'),
        hint: quotaRanking[0]
          ? t('累计消耗 {{quota}}', {
              quota: renderQuota(Number(quotaRanking[0]?.value || 0), 2),
            })
          : t('当前窗口还没有可用消耗数据'),
      },
      {
        key: 'active-models',
        label: t('最近活跃模型数'),
        value: renderNumber(activeModelCount),
        hint: t('统计窗口 {{window}}', { window: activeWindowLabel }),
      },
      {
        key: 'requests',
        label: t('总调用次数'),
        value: renderNumber(times),
        hint: t('累计消耗 {{quota}} · Tokens {{tokens}}', {
          quota: renderQuota(consumeQuota, 2),
          tokens: renderNumber(consumeTokens),
        }),
      },
    ],
    [
      activeModelCount,
      activeWindowLabel,
      consumeQuota,
      consumeTokens,
      quotaRanking,
      requestRanking,
      t,
      times,
      topQuotaModel,
      topRequestModel,
    ],
  );

  return {
    loading,
    refreshing,
    errorMessage,
    user,
    quotaData,
    trendData,
    lineData,
    modelColors,
    consumeQuota,
    consumeTokens,
    times,
    preset,
    dateRange,
    defaultTime,
    timeOptions: TIME_OPTIONS,
    presetOptions: PRESET_OPTIONS,
    activeWindowLabel,
    topQuotaModel,
    topRequestModel,
    quotaRanking,
    requestRanking,
    favoriteModels,
    consumptionModels,
    metricCards,
    handlePresetChange,
    handleDateRangeChange,
    handleDefaultTimeChange,
    handleRefresh,
    navigateToAnalytics,
    navigateToLogs,
    navigateToModel,
    buildLogPath,
    buildModelPath,
  };
};

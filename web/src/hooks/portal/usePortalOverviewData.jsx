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
import { API, renderNumber, renderQuota, showError, timestamp2string, toLocalUnixTimestamp } from '../../helpers';
import { TIME_OPTIONS } from '../../constants';
import { useDashboardCharts } from '../dashboard/useDashboardCharts';

const PRESET_OPTIONS = [
  { key: '24h', label: '24h', seconds: 24 * 60 * 60 },
  { key: '7d', label: '7d', seconds: 7 * 24 * 60 * 60 },
  { key: '30d', label: '30d', seconds: 30 * 24 * 60 * 60 },
];

const BILLING_PREFERENCE_LABELS = {
  subscription_first: '优先使用订阅额度',
  balance_first: '优先使用钱包余额',
};

const formatDateRange = (range) => {
  if (!Array.isArray(range) || range.length !== 2) {
    return [
      timestamp2string(Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60),
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
  const option = PRESET_OPTIONS.find((item) => item.key === preset) || PRESET_OPTIONS[1];
  const end = Math.floor(Date.now() / 1000);
  const start = end - option.seconds;
  return [timestamp2string(start), timestamp2string(end)];
};

const clampPercent = (value) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Number(value.toFixed(1));
};

const getSubscriptionRemainDays = (subscription) => {
  const endTime = subscription?.end_time;
  if (!endTime) {
    return null;
  }
  const now = Date.now();
  const end = Number(endTime) * 1000;
  if (!Number.isFinite(end) || end <= now) {
    return 0;
  }
  return Math.ceil((end - now) / (24 * 60 * 60 * 1000));
};

const buildQuickActions = ({ navigateToWallet, navigateToSubscription, navigateToLogs, navigateToAnalytics }) => [
  {
    key: 'wallet',
    title: '查看钱包与额度',
    description: '快速查看余额、充值入口与余额可支撑天数。',
    actionLabel: '前往钱包',
    onClick: navigateToWallet,
  },
  {
    key: 'subscription',
    title: '管理当前套餐',
    description: '查看订阅权益、已用额度与当前扣费偏好。',
    actionLabel: '查看订阅',
    onClick: navigateToSubscription,
  },
  {
    key: 'logs',
    title: '追踪最近日志',
    description: '带着当前筛选上下文跳到日志中心继续排查。',
    actionLabel: '查看日志',
    onClick: navigateToLogs,
  },
  {
    key: 'analytics',
    title: '深入分析趋势',
    description: '切到分析页查看模型消耗趋势与调用占比。',
    actionLabel: '进入分析',
    onClick: navigateToAnalytics,
  },
];

export const usePortalOverviewData = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [topupInfo, setTopupInfo] = useState(null);
  const [quotaData, setQuotaData] = useState([]);
  const [consumeQuota, setConsumeQuota] = useState(0);
  const [times, setTimes] = useState(0);
  const [consumeTokens, setConsumeTokens] = useState(0);
  const [trendData, setTrendData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [modelColors, setModelColors] = useState({});

  const initialPreset = searchParams.get('preset') || '7d';
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

  const syncSearchParams = useCallback((nextPreset, nextDateRange, nextDefaultTime) => {
    const next = new URLSearchParams(searchParams);
    next.set('preset', nextPreset);
    next.set('default_time', nextDefaultTime);
    next.set('start_timestamp', nextDateRange[0]);
    next.set('end_timestamp', nextDateRange[1]);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadPortalData = useCallback(async (currentDateRange = dateRange, currentDefaultTime = defaultTime) => {
    setRefreshing(true);
    try {
      const [userRes, subscriptionRes, plansRes, topupRes, quotaRes] = await Promise.all([
        API.get('/api/user/self'),
        API.get('/api/subscription/self'),
        API.get('/api/subscription/plans'),
        API.get('/api/user/topup/info'),
        API.get(encodeURI(`/api/data/self?default_time=${currentDefaultTime}&start_timestamp=${toUnixSeconds(currentDateRange[0])}&end_timestamp=${toUnixSeconds(currentDateRange[1])}`)),
      ]);

      const responses = [userRes, subscriptionRes, plansRes, topupRes, quotaRes];
      const failed = responses.find((response) => response?.data?.success === false);
      if (failed) {
        showError(failed.data?.message || t('获取客户门户数据失败'));
        return;
      }

      setUser(userRes.data?.data || null);
      setSubscriptionInfo(subscriptionRes.data?.data || null);
      setSubscriptionPlans(plansRes.data?.data || []);
      setTopupInfo(topupRes.data?.data || null);
      const nextQuotaData = quotaRes.data?.data || [];
      setQuotaData(nextQuotaData);
      dashboardCharts.updateChartData(nextQuotaData);
    } catch (error) {
      showError(error?.message || t('获取客户门户数据失败'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dashboardCharts, dateRange, defaultTime, t]);

  useEffect(() => {
    loadPortalData(dateRange, defaultTime).then();
  }, []);

  const handlePresetChange = useCallback((nextPreset) => {
    const nextDateRange = buildDateRangeFromPreset(nextPreset);
    setPreset(nextPreset);
    setDateRange(nextDateRange);
    syncSearchParams(nextPreset, nextDateRange, defaultTime);
  }, [defaultTime, syncSearchParams]);

  const handleDateRangeChange = useCallback((nextDateRange) => {
    const normalized = formatDateRange(nextDateRange);
    setPreset('custom');
    setDateRange(normalized);
    syncSearchParams('custom', normalized, defaultTime);
  }, [defaultTime, syncSearchParams]);

  const handleDefaultTimeChange = useCallback((value) => {
    setDefaultTime(value);
    syncSearchParams(preset, dateRange, value);
  }, [dateRange, preset, syncSearchParams]);

  const handleRefresh = useCallback(async () => {
    await loadPortalData(dateRange, defaultTime);
  }, [dateRange, defaultTime, loadPortalData]);

  const activeSubscription = useMemo(() => {
    return subscriptionInfo?.subscriptions?.[0]?.subscription || null;
  }, [subscriptionInfo]);

  const planMap = useMemo(() => {
    return subscriptionPlans.reduce((acc, item) => {
      const plan = item?.plan;
      if (plan?.id !== undefined && plan?.id !== null) {
        acc[plan.id] = plan;
      }
      return acc;
    }, {});
  }, [subscriptionPlans]);

  const subscriptionTitle = useMemo(() => {
    const subscription = activeSubscription;
    if (!subscription) {
      return t('当前暂无订阅套餐');
    }
    const matchedPlan = planMap[subscription.plan_id];
    return matchedPlan?.title || subscription.plan_name || t('进行中的订阅套餐');
  }, [activeSubscription, planMap, t]);

  const subscriptionUsagePercent = useMemo(() => {
    const used = Number(activeSubscription?.amount_used || 0);
    const total = Number(activeSubscription?.amount_total || 0);
    if (!total) {
      return 0;
    }
    return clampPercent((used / total) * 100);
  }, [activeSubscription]);

  const subscriptionRemainDays = useMemo(() => {
    return getSubscriptionRemainDays(activeSubscription);
  }, [activeSubscription]);

  const walletBalance = Number(user?.quota || 0);
  const todayQuota = Number(trendData?.[trendData.length - 1]?.quota || 0);
  const averageDailyQuota = useMemo(() => {
    const validItems = trendData.filter((item) => Number(item?.quota || 0) > 0);
    if (!validItems.length) {
      return 0;
    }
    const total = validItems.reduce((sum, item) => sum + Number(item?.quota || 0), 0);
    return total / validItems.length;
  }, [trendData]);

  const balanceCoverageDays = useMemo(() => {
    if (!walletBalance || !averageDailyQuota) {
      return null;
    }
    return Math.floor(walletBalance / averageDailyQuota);
  }, [averageDailyQuota, walletBalance]);

  const quotaRanking = useMemo(() => {
    return [...pieData].sort((a, b) => Number(b.value || 0) - Number(a.value || 0)).slice(0, 5);
  }, [pieData]);

  const requestRanking = useMemo(() => {
    return [...(dashboardCharts.spec_rank_bar?.data?.[0]?.values || [])]
      .sort((a, b) => Number(b.Count || 0) - Number(a.Count || 0))
      .slice(0, 5);
  }, [dashboardCharts.spec_rank_bar]);

  const topQuotaModel = quotaRanking[0]?.type || '';
  const topRequestModel = requestRanking[0]?.Model || '';
  const billingPreferenceLabel = t(BILLING_PREFERENCE_LABELS[subscriptionInfo?.billing_preference || 'subscription_first'] || '优先使用订阅额度');

  const buildLogPath = useCallback((extra = {}) => {
    const next = new URLSearchParams();
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
  }, [dateRange]);

  const buildModelPath = useCallback((modelName) => {
    const next = new URLSearchParams();
    if (modelName) {
      next.set('model', modelName);
      next.set('q', modelName);
    }
    return `/app/models${next.toString() ? `?${next.toString()}` : ''}`;
  }, []);

  const navigateToWallet = useCallback(() => navigate('/app/wallet'), [navigate]);
  const navigateToSubscription = useCallback(() => navigate('/app/subscription'), [navigate]);
  const navigateToAnalytics = useCallback(() => navigate(`/app/analytics?${new URLSearchParams({ preset, default_time: defaultTime, start_timestamp: dateRange[0], end_timestamp: dateRange[1] }).toString()}`), [navigate, preset, defaultTime, dateRange]);
  const navigateToLogs = useCallback((extra) => navigate(buildLogPath(extra)), [buildLogPath, navigate]);
  const navigateToModel = useCallback((modelName) => navigate(buildModelPath(modelName)), [buildModelPath, navigate]);

  const insights = useMemo(() => {
    const items = [];

    if (balanceCoverageDays !== null && balanceCoverageDays <= 7) {
      items.push({
        key: 'balance-alert',
        level: 'warning',
        title: t('余额可支撑时间偏短'),
        description: t('按当前平均消耗速度，钱包余额预计还能支撑 {{days}} 天。', { days: balanceCoverageDays }),
        actionLabel: t('前往钱包'),
        onClick: navigateToWallet,
      });
    }

    if (subscriptionRemainDays !== null && subscriptionRemainDays <= 5) {
      items.push({
        key: 'subscription-expire',
        level: 'critical',
        title: t('订阅即将到期'),
        description: t('当前套餐预计 {{days}} 天后到期，建议提前续费或调整扣费偏好。', { days: subscriptionRemainDays }),
        actionLabel: t('查看订阅'),
        onClick: navigateToSubscription,
      });
    }

    if (topQuotaModel) {
      items.push({
        key: 'top-quota-model',
        level: 'info',
        title: t('高消耗模型需要重点关注'),
        description: t('{{model}} 是当前时间范围内消耗最高的模型，可查看日志进一步定位。', { model: topQuotaModel }),
        actionLabel: t('查看日志'),
        onClick: () => navigateToLogs({ model_name: topQuotaModel }),
      });
    }

    if (topRequestModel) {
      items.push({
        key: 'top-request-model',
        level: 'success',
        title: t('高频模型值得做对比分析'),
        description: t('{{model}} 当前调用最频繁，可跳转模型广场查看替代选项。', { model: topRequestModel }),
        actionLabel: t('查看模型'),
        onClick: () => navigateToModel(topRequestModel),
      });
    }

    return items.slice(0, 4);
  }, [balanceCoverageDays, navigateToLogs, navigateToModel, navigateToSubscription, navigateToWallet, subscriptionRemainDays, t, topQuotaModel, topRequestModel]);

  const overviewMetricCards = useMemo(() => [
    {
      key: 'wallet',
      label: t('钱包余额'),
      value: renderQuota(walletBalance, 2),
      hint: balanceCoverageDays !== null ? t('按当前速度预计可支撑 {{days}} 天', { days: balanceCoverageDays }) : t('暂无可用消耗预测'),
    },
    {
      key: 'subscription',
      label: t('套餐已用'),
      value: `${subscriptionUsagePercent}%`,
      hint: t('当前套餐：{{plan}}', { plan: subscriptionTitle }),
    },
    {
      key: 'quota',
      label: t('时间范围总消耗'),
      value: renderQuota(consumeQuota, 2),
      hint: t('今日消耗 {{quota}}', { quota: renderQuota(todayQuota, 2) }),
    },
    {
      key: 'requests',
      label: t('总调用次数'),
      value: renderNumber(times),
      hint: t('累计消耗 Tokens {{tokens}}', { tokens: renderNumber(consumeTokens) }),
    },
  ], [balanceCoverageDays, consumeQuota, consumeTokens, subscriptionTitle, subscriptionUsagePercent, t, times, todayQuota, walletBalance]);

  const analyticsMetricCards = useMemo(() => [
    ...overviewMetricCards,
    {
      key: 'avg-daily',
      label: t('日均消耗'),
      value: renderQuota(averageDailyQuota, 2),
      hint: t('按当前筛选窗口计算'),
    },
    {
      key: 'billing-preference',
      label: t('当前扣费偏好'),
      value: billingPreferenceLabel,
      hint: t('可在钱包或订阅中心调整'),
    },
  ], [averageDailyQuota, billingPreferenceLabel, overviewMetricCards, t]);

  const quickActions = useMemo(() => {
    return buildQuickActions({ navigateToWallet, navigateToSubscription, navigateToLogs: () => navigateToLogs(), navigateToAnalytics });
  }, [navigateToAnalytics, navigateToLogs, navigateToSubscription, navigateToWallet]);

  return {
    loading,
    refreshing,
    preset,
    setPreset,
    dateRange,
    defaultTime,
    timeOptions: TIME_OPTIONS,
    presetOptions: PRESET_OPTIONS,
    user,
    subscriptionInfo,
    subscriptionTitle,
    subscriptionUsagePercent,
    subscriptionRemainDays,
    billingPreferenceLabel,
    walletBalance,
    balanceCoverageDays,
    consumeQuota,
    consumeTokens,
    times,
    trendData,
    pieData,
    lineData,
    modelColors,
    quotaRanking,
    requestRanking,
    insights,
    overviewMetricCards,
    analyticsMetricCards,
    quickActions,
    specLine: dashboardCharts.spec_line,
    specModelLine: dashboardCharts.spec_model_line,
    specPie: dashboardCharts.spec_pie,
    specRankBar: dashboardCharts.spec_rank_bar,
    handlePresetChange,
    handleDateRangeChange,
    handleDefaultTimeChange,
    handleRefresh,
    navigateToWallet,
    navigateToSubscription,
    navigateToAnalytics,
    navigateToLogs,
    navigateToModel,
    buildLogPath,
    buildModelPath,
  };
};

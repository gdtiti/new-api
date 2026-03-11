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

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Toast } from '@douyinfe/semi-ui';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  API,
  copy,
  getQuotaPerUnit,
  renderQuota,
  renderQuotaWithAmount,
  showError,
  showInfo,
  showSuccess,
  timestamp2string,
} from '../../helpers';

const PAYMENT_METHOD_MAP = {
  stripe: 'Stripe',
  creem: 'Creem',
  alipay: '支付宝',
  wxpay: '微信',
};

const STATUS_LABEL_MAP = {
  success: '成功',
  pending: '待支付',
  expired: '已过期',
};

const BILLING_PREFERENCE_META = {
  subscription_first: {
    label: '优先使用订阅额度',
    description: '调用会先扣减生效订阅额度，钱包余额作为兜底来源。',
    fallbackDescription:
      '当前没有生效订阅，保存为订阅优先时，请求会自动回退到钱包余额。',
  },
  wallet_first: {
    label: '优先使用钱包余额',
    description: '调用会先扣减钱包余额，余额不足时再尝试可用订阅额度。',
    fallbackDescription: '当前以钱包作为主扣费来源，可随时切换到订阅优先。',
  },
  subscription_only: {
    label: '仅使用订阅额度',
    description: '所有请求都只会使用生效订阅额度，不会再消耗钱包余额。',
    fallbackDescription:
      '当前没有生效订阅，仅用订阅会导致请求无法继续，请先开通套餐。',
  },
  wallet_only: {
    label: '仅使用钱包余额',
    description: '所有请求都只会从钱包扣费，订阅额度不会参与扣减。',
    fallbackDescription: '当前只使用钱包余额，充值后即可继续调用。',
  },
};

const isSubscriptionBillingRecord = (record) => {
  const tradeNo = String(record?.trade_no || '').toLowerCase();
  return Number(record?.amount || 0) === 0 && tradeNo.startsWith('sub');
};

const getPaymentMethodLabel = (method, t) =>
  t(PAYMENT_METHOD_MAP[method] || method || '-');

const normalizePayMethods = (rawPayMethods, data) => {
  let nextPayMethods = rawPayMethods;
  if (typeof nextPayMethods === 'string') {
    nextPayMethods = JSON.parse(nextPayMethods || '[]');
  }
  if (!Array.isArray(nextPayMethods)) {
    return [];
  }

  return nextPayMethods
    .filter((method) => method?.name && method?.type)
    .map((method) => {
      const normalizedMinTopup = Number(method.min_topup);
      const nextMethod = {
        ...method,
        min_topup: Number.isFinite(normalizedMinTopup) ? normalizedMinTopup : 0,
      };

      if (
        nextMethod.type === 'stripe' &&
        (!nextMethod.min_topup || nextMethod.min_topup <= 0)
      ) {
        const stripeMin = Number(data?.stripe_min_topup);
        if (Number.isFinite(stripeMin)) {
          nextMethod.min_topup = stripeMin;
        }
      }

      if (!nextMethod.color) {
        if (nextMethod.type === 'alipay') {
          nextMethod.color = 'rgba(var(--semi-blue-5), 1)';
        } else if (nextMethod.type === 'wxpay') {
          nextMethod.color = 'rgba(var(--semi-green-5), 1)';
        } else if (nextMethod.type === 'stripe') {
          nextMethod.color = 'rgba(var(--semi-purple-5), 1)';
        } else {
          nextMethod.color = 'rgba(var(--semi-primary-5), 1)';
        }
      }

      return nextMethod;
    });
};

const parseCreemProducts = (rawProducts) => {
  if (Array.isArray(rawProducts)) {
    return rawProducts;
  }
  if (typeof rawProducts === 'string') {
    return JSON.parse(rawProducts || '[]');
  }
  return [];
};

const formatMoney = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) {
    return '¥0.00';
  }
  return `¥${numericValue.toFixed(2)}`;
};

export const usePortalBillingData = () => {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const [redemptionCode, setRedemptionCode] = useState('');
  const [amount, setAmount] = useState(0.0);
  const [minTopUp, setMinTopUp] = useState(statusState?.status?.min_topup || 1);
  const [topUpCount, setTopUpCount] = useState(
    statusState?.status?.min_topup || 1,
  );
  const [topUpLink, setTopUpLink] = useState(
    statusState?.status?.top_up_link || '',
  );
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(
    statusState?.status?.enable_online_topup || false,
  );
  const [priceRatio, setPriceRatio] = useState(statusState?.status?.price || 1);

  const [enableStripeTopUp, setEnableStripeTopUp] = useState(
    statusState?.status?.enable_stripe_topup || false,
  );
  const [statusLoading, setStatusLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);

  const [creemProducts, setCreemProducts] = useState([]);
  const [enableCreemTopUp, setEnableCreemTopUp] = useState(false);
  const [creemOpen, setCreemOpen] = useState(false);
  const [selectedCreemProduct, setSelectedCreemProduct] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [payWay, setPayWay] = useState('');
  const [amountLoading, setAmountLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [payMethods, setPayMethods] = useState([]);

  const affFetchedRef = useRef(false);

  const [affLink, setAffLink] = useState('');
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);

  const [openHistory, setOpenHistory] = useState(false);

  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [billingPreference, setBillingPreference] =
    useState('subscription_first');
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);

  const [presetAmounts, setPresetAmounts] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  const [topupInfo, setTopupInfo] = useState({
    amount_options: [],
    discount: {},
  });
  const [recentTopups, setRecentTopups] = useState([]);
  const [recentTopupsLoading, setRecentTopupsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const getUserQuota = async () => {
    setUserLoading(true);
    try {
      const res = await API.get('/api/user/self');
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('获取账户信息失败'));
    } finally {
      setUserLoading(false);
    }
  };

  const getSubscriptionPlans = async () => {
    setSubscriptionLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        setSubscriptionPlans(res.data.data || []);
      } else {
        setSubscriptionPlans([]);
      }
    } catch (error) {
      setSubscriptionPlans([]);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const getSubscriptionSelf = async () => {
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) {
        setBillingPreference(
          res.data.data?.billing_preference || 'subscription_first',
        );
        setActiveSubscriptions(res.data.data?.subscriptions || []);
        setAllSubscriptions(res.data.data?.all_subscriptions || []);
      }
    } catch (error) {
      setActiveSubscriptions([]);
      setAllSubscriptions([]);
    }
  };

  const getRecentTopups = async () => {
    setRecentTopupsLoading(true);
    try {
      const res = await API.get('/api/user/topup/self?p=1&page_size=5');
      if (res.data?.success) {
        setRecentTopups(res.data.data?.items || []);
      } else {
        setRecentTopups([]);
      }
    } catch (error) {
      setRecentTopups([]);
    } finally {
      setRecentTopupsLoading(false);
    }
  };

  const renderAmount = () => amount + ' ' + t('元');

  const getAmount = async (value) => {
    const targetAmount = value === undefined ? topUpCount : value;
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/amount', {
        amount: parseFloat(targetAmount),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          setAmount(parseFloat(data));
        } else {
          setAmount(0);
          Toast.error({ content: `${t('错误：')}${data}`, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (error) {
      setAmount(0);
    } finally {
      setAmountLoading(false);
    }
  };

  const getStripeAmount = async (value) => {
    const targetAmount = value === undefined ? topUpCount : value;
    setAmountLoading(true);
    try {
      const res = await API.post('/api/user/stripe/amount', {
        amount: parseFloat(targetAmount),
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          setAmount(parseFloat(data));
        } else {
          setAmount(0);
          Toast.error({ content: `${t('错误：')}${data}`, id: 'getAmount' });
        }
      } else {
        showError(res);
      }
    } catch (error) {
      setAmount(0);
    } finally {
      setAmountLoading(false);
    }
  };

  const generatePresetAmounts = (minAmount) => {
    const multipliers = [1, 5, 10, 30, 50, 100, 300, 500];
    return multipliers.map((multiplier) => ({
      value: minAmount * multiplier,
    }));
  };

  const getTopupInfo = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      const { data, success } = res.data;

      if (!success) {
        return;
      }

      setTopupInfo({
        amount_options: data.amount_options || [],
        discount: data.discount || {},
      });

      const normalizedMethods = normalizePayMethods(
        data.pay_methods || [],
        data,
      );
      setPayMethods(normalizedMethods);

      const nextEnableStripeTopUp = data.enable_stripe_topup || false;
      const nextEnableOnlineTopUp = data.enable_online_topup || false;
      const nextEnableCreemTopUp = data.enable_creem_topup || false;
      const nextMinTopUp = nextEnableOnlineTopUp
        ? data.min_topup
        : nextEnableStripeTopUp
          ? data.stripe_min_topup
          : 1;

      setEnableOnlineTopUp(nextEnableOnlineTopUp);
      setEnableStripeTopUp(nextEnableStripeTopUp);
      setEnableCreemTopUp(nextEnableCreemTopUp);
      setMinTopUp(nextMinTopUp);

      try {
        setCreemProducts(parseCreemProducts(data.creem_products));
      } catch (error) {
        setCreemProducts([]);
      }

      if (
        Array.isArray(data.amount_options) &&
        data.amount_options.length > 0
      ) {
        setPresetAmounts(
          data.amount_options.map((amountOption) => ({
            value: amountOption,
            discount: data.discount?.[amountOption] || 1.0,
          })),
        );
      } else {
        setPresetAmounts(generatePresetAmounts(nextMinTopUp));
      }

      const nextTopUpCount =
        Number(topUpCount || 0) >= Number(nextMinTopUp || 0)
          ? Number(topUpCount || 0)
          : Number(nextMinTopUp || 1);
      setTopUpCount(nextTopUpCount);

      if (
        !Array.isArray(data.amount_options) ||
        !data.amount_options.includes(selectedPreset)
      ) {
        setSelectedPreset(null);
      }

      await getAmount(nextTopUpCount);
    } catch (error) {
      setPayMethods([]);
      setCreemProducts([]);
    }
  };

  const getAffLink = async () => {
    try {
      const res = await API.get('/api/user/aff');
      const { success, message, data } = res.data;
      if (success) {
        setAffLink(`${window.location.origin}/register?aff=${data}`);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('获取邀请链接失败'));
    }
  };

  const topUp = async () => {
    if (redemptionCode === '') {
      showInfo(t('请输入兑换码！'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await API.post('/api/user/topup', {
        key: redemptionCode,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('兑换成功！'));
        Modal.success({
          title: t('兑换成功！'),
          content: t('成功兑换额度：') + renderQuota(data),
          centered: true,
        });
        if (userState.user) {
          const updatedUser = {
            ...userState.user,
            quota: userState.user.quota + data,
          };
          userDispatch({ type: 'login', payload: updatedUser });
        }
        setRedemptionCode('');
        getRecentTopups().then();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('请求失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTopUpLink = () => {
    if (!topUpLink) {
      showError(t('超级管理员未设置充值链接！'));
      return;
    }
    window.open(topUpLink, '_blank');
  };

  const preTopUp = async (payment) => {
    if (payment === 'stripe') {
      if (!enableStripeTopUp) {
        showError(t('管理员未开启Stripe充值！'));
        return;
      }
    } else if (!enableOnlineTopUp) {
      showError(t('管理员未开启在线充值！'));
      return;
    }

    setPayWay(payment);
    setPaymentLoading(true);
    try {
      if (payment === 'stripe') {
        await getStripeAmount();
      } else {
        await getAmount();
      }

      if (topUpCount < minTopUp) {
        showError(t('充值数量不能小于') + minTopUp);
        return;
      }
      setOpen(true);
    } catch (error) {
      showError(t('获取金额失败'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const onlineTopUp = async () => {
    if (payWay === 'stripe') {
      if (amount === 0) {
        await getStripeAmount();
      }
    } else if (amount === 0) {
      await getAmount();
    }

    if (topUpCount < minTopUp) {
      showError(t('充值数量不能小于') + minTopUp);
      return;
    }

    setConfirmLoading(true);
    try {
      let res;
      if (payWay === 'stripe') {
        res = await API.post('/api/user/stripe/pay', {
          amount: parseInt(topUpCount),
          payment_method: 'stripe',
        });
      } else {
        res = await API.post('/api/user/pay', {
          amount: parseInt(topUpCount),
          payment_method: payWay,
        });
      }

      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          if (payWay === 'stripe') {
            window.open(data.pay_link, '_blank');
          } else {
            const params = data;
            const url = res.data.url;
            const form = document.createElement('form');
            form.action = url;
            form.method = 'POST';
            const isSafari =
              navigator.userAgent.indexOf('Safari') > -1 &&
              navigator.userAgent.indexOf('Chrome') < 1;
            if (!isSafari) {
              form.target = '_blank';
            }
            Object.keys(params || {}).forEach((key) => {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = params[key];
              form.appendChild(input);
            });
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
          }
        } else {
          const errorMsg =
            typeof data === 'string' ? data : message || t('支付失败');
          showError(errorMsg);
        }
      } else {
        showError(res);
      }
    } catch (error) {
      showError(t('支付请求失败'));
    } finally {
      setOpen(false);
      setConfirmLoading(false);
    }
  };

  const creemPreTopUp = async (product) => {
    if (!enableCreemTopUp) {
      showError(t('管理员未开启 Creem 充值！'));
      return;
    }
    setSelectedCreemProduct(product);
    setCreemOpen(true);
  };

  const onlineCreemTopUp = async () => {
    if (!selectedCreemProduct) {
      showError(t('请选择产品'));
      return;
    }
    if (!selectedCreemProduct.productId) {
      showError(t('产品配置错误，请联系管理员'));
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await API.post('/api/user/creem/pay', {
        product_id: selectedCreemProduct.productId,
        payment_method: 'creem',
      });
      if (res !== undefined) {
        const { message, data } = res.data;
        if (message === 'success') {
          window.open(data.checkout_url, '_blank');
        } else {
          const errorMsg =
            typeof data === 'string' ? data : message || t('支付失败');
          showError(errorMsg);
        }
      } else {
        showError(res);
      }
    } catch (error) {
      showError(t('支付请求失败'));
    } finally {
      setCreemOpen(false);
      setConfirmLoading(false);
    }
  };

  const updateBillingPreference = async (pref) => {
    const previousPref = billingPreference;
    setBillingPreference(pref);
    try {
      const res = await API.put('/api/subscription/self/preference', {
        billing_preference: pref,
      });
      if (res.data?.success) {
        showSuccess(t('更新成功'));
        const normalizedPref =
          res.data?.data?.billing_preference || pref || previousPref;
        setBillingPreference(normalizedPref);
      } else {
        showError(res.data?.message || t('更新失败'));
        setBillingPreference(previousPref);
      }
    } catch (error) {
      showError(t('请求失败'));
      setBillingPreference(previousPref);
    }
  };

  const transfer = async () => {
    if (transferAmount < getQuotaPerUnit()) {
      showError(t('划转金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }
    try {
      const res = await API.post('/api/user/aff_transfer', {
        quota: transferAmount,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(message);
        setOpenTransfer(false);
        getUserQuota().then();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('划转失败'));
    }
  };

  const handleAffLinkClick = async () => {
    await copy(affLink);
    showSuccess(t('邀请链接已复制到剪切板'));
  };

  const handleCancel = () => setOpen(false);
  const handleTransferCancel = () => setOpenTransfer(false);
  const handleOpenHistory = () => setOpenHistory(true);
  const handleHistoryCancel = () => setOpenHistory(false);
  const handleCreemCancel = () => {
    setCreemOpen(false);
    setSelectedCreemProduct(null);
  };

  const selectPresetAmount = (preset) => {
    setTopUpCount(preset.value);
    setSelectedPreset(preset.value);
    const discount = preset.discount || topupInfo.discount[preset.value] || 1.0;
    setAmount(preset.value * priceRatio * discount);
  };

  const formatLargeNumber = (num) => num.toString();

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        getUserQuota(),
        getTopupInfo(),
        getSubscriptionPlans(),
        getSubscriptionSelf(),
        getRecentTopups(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    getUserQuota().then();
    setTransferAmount(getQuotaPerUnit());
  }, []);

  useEffect(() => {
    if (affFetchedRef.current) return;
    affFetchedRef.current = true;
    getAffLink().then();
  }, []);

  useEffect(() => {
    getTopupInfo().then();
    getSubscriptionPlans().then();
    getSubscriptionSelf().then();
    getRecentTopups().then();
  }, []);

  useEffect(() => {
    if (statusState?.status) {
      setTopUpLink(statusState.status.top_up_link || '');
      setPriceRatio(statusState.status.price || 1);
      setStatusLoading(false);
    }
  }, [statusState?.status]);

  const planTitleMap = useMemo(() => {
    const map = new Map();
    (subscriptionPlans || []).forEach((item) => {
      const plan = item?.plan;
      if (plan?.id) {
        map.set(plan.id, plan.title || '');
      }
    });
    return map;
  }, [subscriptionPlans]);

  const activeSubscriptionCount = activeSubscriptions.length;
  const expiredSubscriptionCount = Math.max(
    0,
    allSubscriptions.length - activeSubscriptions.length,
  );
  const primarySubscription =
    activeSubscriptions[0]?.subscription || allSubscriptions[0]?.subscription;
  const primarySubscriptionTitle = primarySubscription
    ? planTitleMap.get(primarySubscription.plan_id) ||
      `${t('订阅')} #${primarySubscription.id}`
    : t('暂无生效订阅');
  const primarySubscriptionTotal = Number(
    primarySubscription?.amount_total || 0,
  );
  const primarySubscriptionUsed = Number(primarySubscription?.amount_used || 0);
  const primarySubscriptionRemain =
    primarySubscriptionTotal > 0
      ? Math.max(0, primarySubscriptionTotal - primarySubscriptionUsed)
      : 0;
  const primarySubscriptionUsagePercent =
    primarySubscriptionTotal > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (primarySubscriptionUsed / primarySubscriptionTotal) * 100,
            ),
          ),
        )
      : 0;
  const primarySubscriptionRemainDays = (() => {
    if (!primarySubscription?.end_time) {
      return null;
    }
    const now = Date.now() / 1000;
    const remainSeconds = Number(primarySubscription.end_time) - now;
    if (remainSeconds <= 0) {
      return 0;
    }
    return Math.ceil(remainSeconds / 86400);
  })();

  const hasActiveSubscription = activeSubscriptionCount > 0;
  const billingPreferenceMeta =
    BILLING_PREFERENCE_META[billingPreference] ||
    BILLING_PREFERENCE_META.subscription_first;
  const initializing =
    !userState?.user &&
    (userLoading ||
      statusLoading ||
      subscriptionLoading ||
      recentTopupsLoading);
  const billingPreferenceLabel = t(billingPreferenceMeta.label);
  const billingSourceSummary = hasActiveSubscription
    ? t(billingPreferenceMeta.description)
    : t(billingPreferenceMeta.fallbackDescription);

  const paymentMethodSummary = useMemo(
    () =>
      (payMethods || []).map((method) => ({
        ...method,
        displayName: method.name || getPaymentMethodLabel(method.type, t),
        minimumText:
          Number(method.min_topup || 0) > 0
            ? `${t('最低充值')} ${renderQuotaWithAmount(method.min_topup)}`
            : t('按系统最小充值限制执行'),
      })),
    [payMethods, t],
  );

  const recentBillingItems = useMemo(
    () =>
      (recentTopups || []).map((record) => {
        const subscriptionRecord = isSubscriptionBillingRecord(record);
        const statusKey =
          STATUS_LABEL_MAP[record.status] || record.status || '-';
        return {
          key: record.id || record.trade_no,
          tradeNo: record.trade_no,
          sourceLabel: subscriptionRecord ? t('订阅套餐') : t('钱包充值'),
          sourceTone: subscriptionRecord ? 'subscription' : 'wallet',
          paymentMethodLabel: getPaymentMethodLabel(record.payment_method, t),
          amountLabel: subscriptionRecord
            ? t('订阅购买')
            : renderQuota(Number(record.amount || 0)),
          moneyLabel: formatMoney(record.money),
          statusLabel: t(statusKey),
          statusTone: record.status || 'success',
          createdAt: timestamp2string(record.create_time),
        };
      }),
    [recentTopups, t],
  );

  const rechargeCardProps = {
    t,
    enableOnlineTopUp,
    enableStripeTopUp,
    enableCreemTopUp,
    creemProducts,
    creemPreTopUp,
    presetAmounts,
    selectedPreset,
    selectPresetAmount,
    formatLargeNumber,
    priceRatio,
    topUpCount,
    minTopUp,
    renderQuotaWithAmount,
    getAmount,
    setTopUpCount,
    setSelectedPreset,
    renderAmount,
    amountLoading,
    payMethods,
    preTopUp,
    paymentLoading,
    payWay,
    redemptionCode,
    setRedemptionCode,
    topUp,
    isSubmitting,
    topUpLink,
    openTopUpLink,
    userState,
    renderQuota,
    statusLoading,
    topupInfo,
    onOpenHistory: handleOpenHistory,
    subscriptionLoading,
    subscriptionPlans,
    billingPreference,
    onChangeBillingPreference: updateBillingPreference,
    activeSubscriptions,
    allSubscriptions,
    reloadSubscriptionSelf: getSubscriptionSelf,
  };

  const subscriptionCardProps = {
    t,
    loading: subscriptionLoading,
    plans: subscriptionPlans,
    payMethods,
    enableOnlineTopUp,
    enableStripeTopUp,
    enableCreemTopUp,
    billingPreference,
    onChangeBillingPreference: updateBillingPreference,
    activeSubscriptions,
    allSubscriptions,
    reloadSubscriptionSelf: getSubscriptionSelf,
  };

  return {
    t,
    userState,
    affLink,
    openTransfer,
    transferAmount,
    setOpenTransfer,
    setTransferAmount,
    transfer,
    handleAffLinkClick,
    handleTransferCancel,
    rechargeCardProps,
    subscriptionCardProps,
    open,
    onlineTopUp,
    handleCancel,
    confirmLoading,
    topUpCount,
    amountLoading,
    renderAmount,
    payWay,
    payMethods,
    amount,
    topupInfo,
    openHistory,
    handleHistoryCancel,
    handleOpenHistory,
    creemOpen,
    onlineCreemTopUp,
    handleCreemCancel,
    selectedCreemProduct,
    activeSubscriptions,
    allSubscriptions,
    activeSubscriptionCount,
    expiredSubscriptionCount,
    initializing,
    billingPreference,
    billingPreferenceLabel,
    billingSourceSummary,
    paymentMethodSummary,
    recentBillingItems,
    recentTopupsLoading,
    primarySubscription,
    primarySubscriptionTitle,
    primarySubscriptionRemain,
    primarySubscriptionUsed,
    primarySubscriptionUsagePercent,
    primarySubscriptionRemainDays,
    hasActiveSubscription,
    minTopUp,
    refreshAll,
    refreshing,
  };
};

export default usePortalBillingData;

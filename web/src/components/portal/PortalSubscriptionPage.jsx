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

import { Button, Card, Progress, Tag } from '@douyinfe/semi-ui';
import { IconArrowRight, IconRefresh } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';
import { renderQuota } from '../../helpers';
import SubscriptionPlansCard from '../topup/SubscriptionPlansCard';
import usePortalBillingData from '../../hooks/portal/usePortalBillingData';
import PortalBillingOverlays from './PortalBillingOverlays';
import PortalStateBlock from './PortalStateBlock';

const PortalSubscriptionPage = () => {
  const navigate = useNavigate();
  const billing = usePortalBillingData();

  if (billing.initializing && !billing.userState?.user) {
    return (
      <PortalStateBlock
        type='loading'
        title={billing.t('正在加载订阅中心')}
        description={billing.t('正在准备套餐、扣费偏好和订阅账单。')}
      />
    );
  }

  const subscriptionMetricCards = [
    {
      key: 'status',
      label: billing.t('当前订阅状态'),
      value: billing.hasActiveSubscription ? billing.t('已开通') : billing.t('待开通'),
      hint: billing.hasActiveSubscription
        ? billing.t('{{count}} 个订阅正在生效', {
            count: billing.activeSubscriptionCount,
          })
        : billing.t('当前还没有生效套餐'),
      cardClassName: billing.hasActiveSubscription
        ? 'portal-overview__metric--status-active'
        : 'portal-overview__metric--status-pending',
    },
    {
      key: 'next-action',
      label: billing.t('推荐动作'),
      value: billing.hasActiveSubscription ? billing.t('管理续费') : billing.t('去选套餐'),
      hint: billing.hasActiveSubscription
        ? billing.t('下拉查看可续费或升级的套餐')
        : billing.t('直接从下方挑选套餐并开通'),
      valueClassName: 'portal-overview__metric-value--compact',
      cardClassName: 'portal-overview__metric--action',
    },
    {
      key: 'preference',
      label: billing.t('计费规则'),
      value: billing.billingPreferenceLabel,
      hint: billing.t('生效后会按这个顺序结算'),
      valueClassName: 'portal-overview__metric-value--compact',
    },
  ];
  const showRecentBillingCard = billing.recentBillingItems.length > 0;
  const showPaymentMethodsCard = billing.paymentMethodSummary.length > 0;
  const showSubscriptionSide = showRecentBillingCard;
  const showUsageProgress = billing.hasActiveSubscription;
  const hasPlanChoices = (billing.subscriptionCardProps?.plans?.length || 0) > 0;
  const handleScrollToPlans = () => {
    const plansSection = document.getElementById('portal-subscription-plans');
    plansSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const purchaseGuideItems = [
    {
      key: 'plan',
      label: billing.t('1. 选择套餐'),
      value: billing.hasActiveSubscription
        ? billing.t('续费 / 升级')
        : billing.t('价格 / 周期 / 权益'),
      description: hasPlanChoices
        ? billing.hasActiveSubscription
          ? billing.t('直接从下方查看当前可续费或可升级的套餐。')
          : billing.t('从下方直接比较价格、周期和权益后完成开通。')
        : billing.t('套餐上架后会直接在这里显示。'),
      actionLabel: hasPlanChoices
        ? billing.hasActiveSubscription
          ? billing.t('查看可续费套餐')
          : billing.t('去选套餐')
        : billing.t('刷新套餐列表'),
      onAction: hasPlanChoices ? handleScrollToPlans : billing.refreshAll,
      highlighted: true,
    },
    {
      key: 'billing',
      label: billing.t('2. 确认结算顺序'),
      value: billing.t('{{mode}}', {
        mode: billing.billingPreferenceLabel,
      }),
      description: billing.hasActiveSubscription
        ? billing.t('购买前先确认订阅优先还是余额优先，避免扣费顺序和预期不一致。')
        : billing.t('套餐开通后会按这个顺序结算。'),
      actionLabel: hasPlanChoices ? billing.t('查看扣费顺序') : billing.t('刷新状态'),
      onAction: hasPlanChoices ? handleScrollToPlans : billing.refreshAll,
    },
    {
      key: 'activate',
      label: billing.t('3. 生效后再回来'),
      value: billing.hasActiveSubscription
        ? billing.t('额度 / 到期 / 账单')
        : billing.t('开通后在这里确认状态'),
      description: showRecentBillingCard
        ? billing.t('支付完成后可以直接查看最近账单和生效状态。')
        : billing.t('支付完成后刷新页面，查看额度、到期时间和状态。'),
      actionLabel: showRecentBillingCard ? billing.t('查看账单') : billing.t('刷新状态'),
      onAction: showRecentBillingCard
        ? billing.handleOpenHistory
        : billing.refreshAll,
    },
  ];
  const purchaseStatusItems = [
    {
      key: 'billing-order',
      label: billing.t('扣费顺序'),
      value: billing.billingPreferenceLabel,
    },
    {
      key: 'subscription-status',
      label: billing.t('订阅状态'),
      value: billing.hasActiveSubscription ? billing.t('生效中') : billing.t('待开通'),
    },
  ];

  return (
    <div className='portal-overview portal-billing'>
      <div className='portal-page-head'>
        <div className='portal-page-head__main'>
          <div className='portal-page-head__eyebrow'>{billing.t('订阅中心')}</div>
          <h1 className='portal-page-head__title'>{billing.t('订阅与续费')}</h1>
        </div>
        <div className='portal-page-head__actions'>
          <Button
            theme='solid'
            type='primary'
            icon={<IconRefresh />}
            size='small'
            loading={billing.refreshing}
            onClick={billing.refreshAll}
          >
            {billing.t('刷新数据')}
          </Button>
          {!billing.hasActiveSubscription ? (
            <Button
              theme='light'
              type='tertiary'
              icon={<IconArrowRight />}
              size='small'
              onClick={handleScrollToPlans}
            >
              {billing.t('去选套餐')}
            </Button>
          ) : null}
          <Button
            theme='borderless'
            type='tertiary'
            icon={<IconArrowRight />}
            size='small'
            onClick={() => navigate('/app/logs')}
          >
            {billing.t('扣费日志')}
          </Button>
        </div>
      </div>

      <div className='portal-overview__metrics portal-overview__metrics--billing'>
        {subscriptionMetricCards.map((item) => (
          <Card
            key={item.key}
            className={`portal-panel portal-overview__metric portal-overview__metric--compact${item.cardClassName ? ` ${item.cardClassName}` : ''}`}
            bordered={false}
          >
            <span className='portal-overview__metric-label'>{item.label}</span>
            <strong
              className={`portal-overview__metric-value${item.valueClassName ? ` ${item.valueClassName}` : ''}`}
            >
              {item.value}
            </strong>
            {item.hint ? (
              <small className='portal-overview__metric-hint'>{item.hint}</small>
            ) : null}
          </Card>
        ))}
      </div>

      <div className='portal-billing__summary-grid portal-billing__summary-grid--single'>
        <Card
          className='portal-panel portal-billing__summary portal-billing__summary--subscription'
          bordered={false}
        >
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>
                {billing.t('当前套餐状态')}
              </div>
              <h2>{billing.primarySubscriptionTitle}</h2>
            </div>
            <Tag
              color={billing.hasActiveSubscription ? 'green' : 'grey'}
              shape='circle'
            >
              {billing.hasActiveSubscription
                ? billing.t('生效中')
                : billing.t('暂无生效订阅')}
            </Tag>
          </div>
          <div className='portal-billing__summary-metrics'>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('已用额度')}</span>
              <strong>
                {billing.hasActiveSubscription
                  ? renderQuota(billing.primarySubscriptionUsed)
                  : billing.t('待开通')}
              </strong>
            </div>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('剩余额度')}</span>
              <strong>
                {billing.hasActiveSubscription
                  ? renderQuota(billing.primarySubscriptionRemain)
                  : billing.t('待开通')}
              </strong>
            </div>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('剩余天数')}</span>
              <strong>
                {!billing.hasActiveSubscription
                  ? billing.t('待开通')
                  : billing.primarySubscriptionRemainDays === null
                    ? billing.t('未设置')
                  : billing.t('{{days}} 天', {
                      days: billing.primarySubscriptionRemainDays,
                    })}
              </strong>
            </div>
          </div>
          {showUsageProgress ? (
            <div className='portal-billing__summary-progress'>
              <Progress
                percent={billing.primarySubscriptionUsagePercent}
                stroke='#7c3aed'
                showInfo
                format={(percent) => `${percent}%`}
              />
            </div>
          ) : (
            <div className='portal-billing__summary-note'>
              <strong>{billing.t('当前还没有生效套餐')}</strong>
              <span>
                {billing.t(
                  '选择下方套餐后，这里会显示额度占用、到期时间和续费状态。',
                )}
              </span>
              <Button
                theme='solid'
                type='primary'
                icon={<IconArrowRight />}
                onClick={handleScrollToPlans}
              >
                {billing.t('去选套餐')}
              </Button>
            </div>
          )}
          {showPaymentMethodsCard ? (
            <div className='portal-billing__inline-section'>
              <div className='portal-overview__eyebrow'>
                {billing.t('支付方式')}
              </div>
              <div className='portal-billing__method-list'>
                {billing.paymentMethodSummary.map((method) => (
                  <div className='portal-billing__method' key={method.type}>
                    <div>
                      <strong>{method.displayName}</strong>
                      <p>{method.minimumText}</p>
                    </div>
                    <div className='portal-billing__method-indicator'>
                      <span
                        className='portal-billing__method-dot'
                        style={{ background: method.color }}
                      />
                      <span className='portal-billing__method-status'>
                        {billing.t('可用')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div
        className={`portal-billing__content-grid portal-billing__content-grid--subscription${showSubscriptionSide ? '' : ' portal-billing__content-grid--single'}`}
      >
        <div className='portal-billing__main'>
          <Card
            id='portal-subscription-plans'
            className='portal-panel portal-billing__plans'
            bordered={false}
          >
            <div className='portal-overview__section-head'>
              <div>
                <div className='portal-overview__eyebrow'>
                  {billing.t('升级与续费')}
                </div>
                <h2>{billing.t('选择套餐')}</h2>
                <p className='portal-billing__plans-note'>
                  {hasPlanChoices
                    ? billing.hasActiveSubscription
                      ? billing.t('按当前使用情况继续续费，或直接切换到更合适的套餐。')
                      : billing.t('从这里直接挑选套餐、查看价格和权益后完成开通。')
                    : billing.t('当前还没有可购买套餐，套餐开通后会直接显示在这里。')}
                </p>
              </div>
            </div>
            {hasPlanChoices ? (
              <div className='portal-billing__purchase-rail'>
                {purchaseGuideItems.map((item, index) => (
                  <div
                    key={item.key}
                    className={`portal-billing__purchase-step${item.highlighted ? ' portal-billing__purchase-step--primary' : ''}`}
                  >
                    <div className='portal-billing__purchase-step-head'>
                      <span className='portal-billing__purchase-step-index'>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className='portal-billing__purchase-step-label'>
                        {item.label}
                      </span>
                    </div>
                    <strong>{item.value}</strong>
                    <p>{item.description}</p>
                    <Button
                      theme={item.highlighted ? 'solid' : 'light'}
                      type='primary'
                      icon={<IconArrowRight />}
                      onClick={item.onAction}
                    >
                      {item.actionLabel}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className='portal-billing__purchase-strip'>
                <div className='portal-billing__purchase-strip-main'>
                  <span>{billing.t('当前没有可购买套餐')}</span>
                  <strong>{billing.t('先刷新套餐列表，再回来选套餐')}</strong>
                </div>
                <Button
                  theme='solid'
                  type='primary'
                  icon={<IconRefresh />}
                  loading={billing.refreshing}
                  onClick={billing.refreshAll}
                >
                  {billing.t('刷新套餐列表')}
                </Button>
                {purchaseStatusItems.map((item) => (
                  <div key={item.key} className='portal-billing__purchase-badge'>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            )}
            {hasPlanChoices ? (
              <SubscriptionPlansCard
                {...billing.subscriptionCardProps}
                withCard={false}
              />
            ) : (
              <div className='portal-billing__plans-empty-shell'>
                <div className='portal-billing__plans-empty-inline'>
                  <strong>{billing.t('套餐列表暂时为空')}</strong>
                  <p>
                    {billing.t('套餐上架后会直接显示在这里，无需再切换页面。')}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {showSubscriptionSide ? (
          <div className='portal-billing__side'>
            {showRecentBillingCard ? (
              <Card
                className='portal-panel portal-detail-panel portal-billing__side-card'
                bordered={false}
              >
                <div className='portal-overview__section-head'>
                  <div>
                    <div className='portal-overview__eyebrow'>
                      {billing.t('最近账单')}
                    </div>
                    <h2>{billing.t('套餐购买与支付摘要')}</h2>
                  </div>
                  <Button
                    theme='borderless'
                    type='tertiary'
                    icon={<IconArrowRight />}
                    onClick={billing.handleOpenHistory}
                  >
                    {billing.t('查看完整账单')}
                  </Button>
                </div>
                <div className='portal-billing__record-list'>
                  {billing.recentBillingItems.map((item) => (
                    <div className='portal-billing__record' key={item.key}>
                      <div>
                        <strong>{item.sourceLabel}</strong>
                        <p>
                          {item.paymentMethodLabel} · {item.createdAt}
                        </p>
                      </div>
                      <div className='portal-billing__record-meta'>
                        <span>{item.moneyLabel}</span>
                        <Tag
                          color={
                            item.sourceTone === 'subscription'
                              ? 'violet'
                              : 'green'
                          }
                          shape='circle'
                        >
                          {item.amountLabel}
                        </Tag>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

          </div>
        ) : null}
      </div>

      <PortalBillingOverlays billing={billing} />
    </div>
  );
};

export default PortalSubscriptionPage;

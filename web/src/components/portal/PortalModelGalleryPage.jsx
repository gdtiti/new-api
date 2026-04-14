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

import { Button, Card } from '@douyinfe/semi-ui';
import { useOutletContext } from 'react-router-dom';
import { IconActivity, IconHistogram, IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import PricingPage from '../table/model-pricing/layout/PricingPage';
import PortalTimeRangeBar from './PortalTimeRangeBar';
import { usePortalModelGalleryData } from '../../hooks/portal/usePortalModelGalleryData';
import PortalStateBlock from './PortalStateBlock';

const renderModelInsightList = (items, emptyTitle, emptyDescription, t) => {
  if (!items.length) {
    return (
      <PortalStateBlock
        compact
        contained={false}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className='portal-model-gallery__insight-list'>
      {items.map((item, index) => (
        <div key={item.key} className='portal-model-gallery__insight-item'>
          <div className='portal-model-gallery__insight-main'>
            <span className='portal-model-gallery__insight-index'>
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <strong>{item.modelName}</strong>
              <p>{item.description}</p>
            </div>
          </div>
          <div className='portal-model-gallery__insight-side'>
            <span>{item.value}</span>
            <Button
              theme='light'
              type='primary'
              icon={<IconSearch />}
              onClick={item.onOpenModel}
            >
              {t('查看详情')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

const PortalModelGalleryPage = () => {
  const { t } = useTranslation();
  const { portalSkinKey } = useOutletContext() || {};
  const gallery = usePortalModelGalleryData(portalSkinKey);

  if (gallery.loading) {
    return (
      <PortalStateBlock
        type='loading'
        title={t('正在加载模型广场')}
        description={t('正在准备模型分析、个人高频模型与目录视图。')}
      />
    );
  }

  if (gallery.errorMessage && !gallery.user) {
    return (
      <PortalStateBlock
        type='error'
        title={t('模型广场加载失败')}
        description={gallery.errorMessage}
        onAction={gallery.handleRefresh}
      />
    );
  }

  const heroModel = gallery.topRequestModel || gallery.topQuotaModel;
  const metricCards = gallery.metricCards.slice(0, 3);
  const showFavoriteModels = gallery.favoriteModels.length > 0;
  const showConsumptionModels = gallery.consumptionModels.length > 0;
  const showInsightSections = showFavoriteModels || showConsumptionModels;
  const showMetricCards = showInsightSections;
  const currentCustomerName =
    gallery.user?.display_name || gallery.user?.username || t('当前客户');

  return (
    <div className='portal-model-gallery'>
      <PortalTimeRangeBar
        preset={gallery.preset}
        presetOptions={gallery.presetOptions}
        dateRange={gallery.dateRange}
        defaultTime={gallery.defaultTime}
        timeOptions={gallery.timeOptions}
        refreshing={gallery.refreshing}
        onPresetChange={gallery.handlePresetChange}
        onDateRangeChange={gallery.handleDateRangeChange}
        onDefaultTimeChange={gallery.handleDefaultTimeChange}
        onRefresh={gallery.handleRefresh}
      />

      <div className='portal-page-head'>
        <div className='portal-page-head__main'>
          <div className='portal-page-head__eyebrow'>{t('模型广场')}</div>
          <h1 className='portal-page-head__title'>
            {t('直接查看 {{name}} 的重点模型', {
              name: currentCustomerName,
            })}
          </h1>
          <p className='portal-page-head__description'>
            {heroModel
              ? t('当前窗口 {{window}} · 重点模型 {{model}}', {
                  window: gallery.activeWindowLabel,
                  model: heroModel,
                })
              : t('当前窗口 {{window}}，有真实调用后再突出重点模型。', {
                  window: gallery.activeWindowLabel,
                })}
          </p>
        </div>
        {heroModel ? (
          <div className='portal-page-head__actions'>
            <Button
              theme='solid'
              type='primary'
              icon={<IconSearch />}
              size='small'
              onClick={() =>
                heroModel
                  ? gallery.navigateToModel(heroModel)
                  : gallery.navigateToAnalytics()
              }
            >
              {heroModel ? t('打开当前重点模型') : t('查看模型分析')}
            </Button>
            <Button
              theme='light'
              type='primary'
              icon={<IconActivity />}
              size='small'
              onClick={() =>
                heroModel
                  ? gallery.navigateToLogs({ model_name: heroModel })
                  : gallery.navigateToLogs()
              }
            >
              {t('查看相关日志')}
            </Button>
            <Button
              theme='borderless'
              type='tertiary'
              icon={<IconHistogram />}
              size='small'
              onClick={gallery.navigateToAnalytics}
            >
              {t('前往分析页')}
            </Button>
          </div>
        ) : null}
      </div>

      {showMetricCards ? (
        <div className='portal-overview__metrics portal-model-gallery__metrics'>
          {metricCards.map((item) => (
            <Card
              key={item.key}
              className='portal-panel portal-overview__metric'
              bordered={false}
            >
              <span className='portal-overview__metric-label'>{item.label}</span>
              <strong className='portal-overview__metric-value'>
                {item.value}
              </strong>
              <small className='portal-overview__metric-hint'>{item.hint}</small>
            </Card>
          ))}
        </div>
      ) : null}

      {showInsightSections ? (
        <div
          className={`portal-model-gallery__insights${showFavoriteModels && showConsumptionModels ? '' : ' portal-model-gallery__insights--single'}`}
        >
          {showFavoriteModels ? (
            <Card
              className='portal-panel portal-detail-panel portal-model-gallery__insight-card'
              bordered={false}
            >
              <div className='portal-overview__section-head'>
                <div>
                  <div className='portal-overview__eyebrow'>{t('个人视角')}</div>
                  <h2>{t('我的高频模型')}</h2>
                </div>
              </div>
              {renderModelInsightList(
                gallery.favoriteModels,
                t('暂无高频模型'),
                t('切换时间窗口或开始调用后，这里会显示你最常用的模型。'),
                t,
              )}
            </Card>
          ) : null}

          {showConsumptionModels ? (
            <Card
              className='portal-panel portal-detail-panel portal-model-gallery__insight-card'
              bordered={false}
            >
              <div className='portal-overview__section-head'>
                <div>
                  <div className='portal-overview__eyebrow'>{t('消耗视角')}</div>
                  <h2>{t('近期高消耗模型')}</h2>
                </div>
              </div>
              {renderModelInsightList(
                gallery.consumptionModels,
                t('暂无消耗数据'),
                t('当前窗口内还没有模型消耗记录，稍后回来这里查看。'),
                t,
              )}
            </Card>
          ) : null}
        </div>
      ) : (
        <Card
          className='portal-panel portal-detail-panel portal-model-gallery__insight-card'
          bordered={false}
        >
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>{t('重点模型')}</div>
              <h2>{t('当前窗口还没有形成模型排行')}</h2>
            </div>
          </div>
          <PortalStateBlock
            compact
            contained={false}
            title={t('暂无高频或高消耗模型')}
            description={t('等真实调用进入当前时间窗口后，这里再展开模型排行。')}
            actionLabel={t('查看模型分析')}
            actionIcon={<IconSearch />}
            onAction={gallery.navigateToAnalytics}
          />
        </Card>
      )}

      <div className='portal-model-gallery__directory'>
        <div className='portal-model-gallery__directory-head portal-model-gallery__directory-head--compact'>
          <div>
            <div className='portal-overview__eyebrow'>{t('统一目录')}</div>
            <h2>{t('搜索、筛选、排序与详情视图')}</h2>
          </div>
        </div>

        <PricingPage portalMode compactHeader />
      </div>
    </div>
  );
};

export default PortalModelGalleryPage;

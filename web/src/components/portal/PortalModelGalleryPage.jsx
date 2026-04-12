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
import {
  IconActivity,
  IconArrowRight,
  IconList,
  IconPulse,
  IconSearch,
} from '@douyinfe/semi-icons';
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
            <div className='portal-model-gallery__insight-actions'>
              <Button
                theme='light'
                type='primary'
                icon={<IconSearch />}
                onClick={item.onOpenModel}
              >
                {t('模型详情')}
              </Button>
              <Button
                theme='borderless'
                type='tertiary'
                icon={<IconArrowRight />}
                onClick={item.onOpenLogs}
              >
                {t('查看日志')}
              </Button>
            </div>
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

      <Card
        className='portal-panel portal-model-gallery__hero'
        bordered={false}
      >
        <div className='portal-model-gallery__hero-content'>
          <div>
            <div className='portal-overview__eyebrow'>{t('模型广场')}</div>
            <h1 className='portal-overview__hero-title'>
              {t('为 {{name}} 推荐更合适的模型组合', {
                name:
                  gallery.user?.display_name ||
                  gallery.user?.username ||
                  t('当前客户'),
              })}
            </h1>
            <p className='portal-overview__hero-description'>
              {t(
                '这里把模型目录、高频模型和高消耗模型按同一套节奏整理在一起，先看重点，再继续筛选、对比和追踪日志。',
              )}
            </p>
          </div>
          <div className='portal-model-gallery__hero-actions'>
            <Button
              theme='solid'
              type='primary'
              icon={<IconSearch />}
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
              onClick={() =>
                heroModel
                  ? gallery.navigateToLogs({ model_name: heroModel })
                  : gallery.navigateToLogs()
              }
            >
              {t('查看相关日志')}
            </Button>
          </div>
        </div>
        <div className='portal-model-gallery__hero-side'>
          <div className='portal-model-gallery__hero-kpi'>
            <span>{t('当前分析窗口')}</span>
            <strong>{gallery.activeWindowLabel}</strong>
            <small>
              {gallery.dateRange?.[0]} 至 {gallery.dateRange?.[1]}
            </small>
          </div>
          <div className='portal-model-gallery__hero-kpi'>
            <span>{t('当前重点模型')}</span>
            <strong>{heroModel || t('暂无数据')}</strong>
            <small>
              {heroModel
                ? t('可直接打开详情或跳转日志中心继续分析')
                : t('当有模型使用数据后，这里会自动高亮')}
            </small>
          </div>
        </div>
      </Card>

      <div className='portal-overview__metrics portal-model-gallery__metrics'>
        {gallery.metricCards.map((item) => (
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

      <div className='portal-model-gallery__insights'>
        <Card
          className='portal-panel portal-detail-panel portal-model-gallery__insight-card'
          bordered={false}
        >
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>{t('个人视角')}</div>
              <h2>{t('我的高频模型')}</h2>
            </div>
            <Button
              theme='borderless'
              type='tertiary'
              icon={<IconList />}
              onClick={gallery.navigateToAnalytics}
            >
              {t('查看调用趋势')}
            </Button>
          </div>
          {renderModelInsightList(
            gallery.favoriteModels,
            t('暂无高频模型'),
            t('切换时间窗口或开始调用后，这里会显示你最常用的模型。'),
            t,
          )}
        </Card>

        <Card
          className='portal-panel portal-detail-panel portal-model-gallery__insight-card'
          bordered={false}
        >
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>{t('消耗视角')}</div>
              <h2>{t('近期高消耗模型')}</h2>
            </div>
            <Button
              theme='borderless'
              type='tertiary'
              icon={<IconPulse />}
              onClick={gallery.navigateToAnalytics}
            >
              {t('查看消耗趋势')}
            </Button>
          </div>
          {renderModelInsightList(
            gallery.consumptionModels,
            t('暂无消耗数据'),
            t('当前窗口内还没有模型消耗记录，稍后回来这里查看。'),
            t,
          )}
        </Card>
      </div>

      <div className='portal-model-gallery__directory'>
        <div className='portal-overview__section-head portal-model-gallery__directory-head'>
          <div>
            <div className='portal-overview__eyebrow'>{t('统一目录')}</div>
            <h2>{t('搜索、筛选、排序与详情视图')}</h2>
            <p className='portal-model-gallery__directory-description'>
              {t(
                '下方直接复用现有模型目录能力，并迁入客户门户。你可以继续搜索模型、筛选供应商与端点、切换卡片或表格视图，并在统一详情面板里查看定价和可用端点。',
              )}
            </p>
          </div>
          <Button
            theme='light'
            type='primary'
            icon={<IconArrowRight />}
            onClick={() =>
              heroModel
                ? gallery.navigateToLogs({ model_name: heroModel })
                : gallery.navigateToLogs()
            }
          >
            {t('查看当前重点模型日志')}
          </Button>
        </div>

        <PricingPage portalMode />
      </div>
    </div>
  );
};

export default PortalModelGalleryPage;

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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Input, Select, Tag } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { Activity, Boxes, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { timestamp2string, toLocalUnixMilliseconds } from '../../helpers';
import { TIME_OPTIONS } from '../../constants';
import { CARD_PROPS, CHART_CONFIG } from '../../constants/dashboard.constants';
import { useQualityAnalytics } from '../../hooks/dashboard/useQualityAnalytics';
import QualityAnalysisPanel from './QualityAnalysisPanel';

const buildInitialDateRange = () => {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 7 * 24 * 60 * 60;
  return [timestamp2string(start), timestamp2string(end)];
};

const normalizeDatePickerValue = (dateRange) => {
  if (!Array.isArray(dateRange) || dateRange.length !== 2) {
    return [];
  }

  const nextValue = dateRange
    .map((item) => {
      if (item instanceof Date && !Number.isNaN(item.getTime())) {
        return item;
      }

      const milliseconds = toLocalUnixMilliseconds(item);
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
        return null;
      }

      const nextDate = new Date(milliseconds);
      return Number.isNaN(nextDate.getTime()) ? null : nextDate;
    })
    .filter(Boolean);

  return nextValue.length === 2 ? nextValue : [];
};

const normalizeChangeResult = (value, valueString) => {
  if (
    Array.isArray(valueString) &&
    valueString.length === 2 &&
    valueString.every(Boolean)
  ) {
    return valueString;
  }

  if (!Array.isArray(value) || value.length !== 2) {
    return value;
  }

  return value.map((item) => {
    if (item instanceof Date && !Number.isNaN(item.getTime())) {
      return timestamp2string(Math.floor(item.getTime() / 1000));
    }
    return item;
  });
};

const ANALYTICS_META = {
  channel: {
    title: '渠道分析',
    description: '查看各渠道在请求量、成功率、时延和估算并发上的质量表现。',
    icon: <Layers size={18} />,
  },
  model: {
    title: '模型分析',
    description: '查看各模型在请求量、成功率、时延和稳定性上的表现差异。',
    icon: <Boxes size={18} />,
  },
};

const QualityAnalyticsWorkspace = ({ dimension }) => {
  const { t } = useTranslation();
  const meta = ANALYTICS_META[dimension] || ANALYTICS_META.channel;
  const initialDateRange = useMemo(() => buildInitialDateRange(), []);
  const [filters, setFilters] = useState({
    start_timestamp: initialDateRange[0],
    end_timestamp: initialDateRange[1],
    username: '',
    default_time: 'day',
  });

  const {
    analyticsLoading,
    channelAnalytics,
    modelAnalytics,
    loadAnalytics,
  } = useQualityAnalytics(filters, filters.default_time, true);

  const analytics =
    dimension === 'model' ? modelAnalytics : channelAnalytics;

  const pickerValue = useMemo(
    () =>
      normalizeDatePickerValue([
        filters.start_timestamp,
        filters.end_timestamp,
      ]),
    [filters.end_timestamp, filters.start_timestamp],
  );

  const handleRefresh = useCallback(async () => {
    await loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    // 首次进入页面时拉取一次，后续由用户主动刷新。
    handleRefresh();
  }, []);

  return (
    <div className='mt-[60px] px-2 space-y-4'>
      <Card
        {...CARD_PROPS}
        title={
          <div className='flex items-center gap-2'>
            {meta.icon}
            {t(meta.title)}
          </div>
        }
      >
        <div className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
          <div className='space-y-3'>
            <p className='m-0 max-w-3xl text-sm text-semi-color-text-2'>
              {t(meta.description)}
            </p>
            <div className='flex flex-wrap gap-2'>
              <Tag color='blue' shape='circle'>
                {t('时间粒度')} · {filters.default_time}
              </Tag>
              <Tag color='grey' shape='circle'>
                {filters.start_timestamp} ~ {filters.end_timestamp}
              </Tag>
              {filters.username ? (
                <Tag color='green' shape='circle'>
                  {t('用户')} · {filters.username}
                </Tag>
              ) : null}
            </div>
          </div>

          <div className='grid w-full gap-3 md:grid-cols-2 xl:w-auto xl:grid-cols-[320px_160px_220px_auto]'>
            <DatePicker
              type='dateTimeRange'
              value={pickerValue}
              onChange={(value, valueString) => {
                const nextDateRange = normalizeChangeResult(value, valueString);
                if (Array.isArray(nextDateRange) && nextDateRange.length === 2) {
                  setFilters((prev) => ({
                    ...prev,
                    start_timestamp: nextDateRange[0],
                    end_timestamp: nextDateRange[1],
                  }));
                }
              }}
              insetLabel={t('时间范围')}
            />
            <Select
              value={filters.default_time}
              optionList={TIME_OPTIONS}
              insetLabel={t('粒度')}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, default_time: value }))
              }
            />
            <Input
              value={filters.username}
              placeholder={t('按用户名筛选，留空则查看全部')}
              prefix={<Activity size={14} />}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, username: value.trim() }))
              }
            />
            <Button
              type='primary'
              theme='solid'
              icon={<IconRefresh />}
              loading={analyticsLoading}
              onClick={handleRefresh}
            >
              {t('刷新分析')}
            </Button>
          </div>
        </div>
      </Card>

      <QualityAnalysisPanel
        title={t(dimension === 'model' ? '模型质量分析' : '渠道质量分析')}
        analytics={analytics}
        loading={analyticsLoading}
        CARD_PROPS={CARD_PROPS}
        CHART_CONFIG={CHART_CONFIG}
        t={t}
      />
    </div>
  );
};

export default QualityAnalyticsWorkspace;

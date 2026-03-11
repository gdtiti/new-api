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

import { Button, Empty, Skeleton } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const buildClassName = ({ compact, contained, className }) =>
  [
    contained ? 'portal-panel' : '',
    'portal-state-block',
    compact ? 'portal-state-block--compact' : '',
    contained ? '' : 'portal-state-block--embedded',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

const PortalStateBlock = ({
  type = 'empty',
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  contained = true,
  className,
}) => {
  const { t } = useTranslation();
  const rootClassName = buildClassName({ compact, contained, className });

  if (type === 'loading') {
    return (
      <div className={rootClassName}>
        <div className='portal-state-block__loading'>
          <Skeleton
            placeholder={
              <Skeleton.Image
                style={{
                  width: '100%',
                  height: compact ? 120 : 220,
                  borderRadius: compact ? 18 : 24,
                }}
              />
            }
            loading
          />
          <div className='portal-state-block__skeleton-grid'>
            {Array.from({ length: compact ? 2 : 3 }).map((_, index) => (
              <Skeleton
                key={index}
                placeholder={
                  <Skeleton.Image
                    style={{
                      width: '100%',
                      height: compact ? 72 : 96,
                      borderRadius: 18,
                    }}
                  />
                }
                loading
              />
            ))}
          </div>
          {description ? (
            <p className='portal-state-block__description'>{description}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const resolvedTitle =
    title || (type === 'error' ? t('加载失败') : t('暂无数据'));
  const resolvedDescription =
    description ||
    (type === 'error'
      ? t('请稍后重试，或刷新页面后继续查看。')
      : t('当前还没有可展示的数据。'));

  return (
    <div className={rootClassName}>
      <Empty title={resolvedTitle} description={resolvedDescription} />
      {onAction ? (
        <Button
          className='portal-state-block__action'
          theme='light'
          type='primary'
          icon={<IconRefresh />}
          onClick={onAction}
        >
          {actionLabel || t('重新加载')}
        </Button>
      ) : null}
    </div>
  );
};

export default PortalStateBlock;

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

import { useMemo } from 'react';
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { Check, ChevronDown, Palette } from 'lucide-react';
import { PORTAL_SKINS } from './portalSkin';

const PORTAL_FAMILY_LABELS = {
  pulse: '时尚',
  summit: '大气',
  mist: '护眼',
};

const PORTAL_MODE_LABELS = {
  light: '浅色',
  dark: '深色',
};

const PortalThemePicker = ({ selectedSkinKey, onSelect, t }) => {
  const selectedSkin = useMemo(
    () =>
      PORTAL_SKINS.find((skin) => skin.key === selectedSkinKey) ||
      PORTAL_SKINS[0],
    [selectedSkinKey],
  );

  return (
    <Dropdown
      position='bottomRight'
      render={
        <Dropdown.Menu className='portal-skin-picker__menu'>
          {PORTAL_SKINS.map((skin) => {
            const active = skin.key === selectedSkinKey;
            return (
              <Dropdown.Item
                key={skin.key}
                onClick={() => onSelect(skin.key)}
                className={[
                  'portal-skin-picker__item',
                  active ? 'portal-skin-picker__item--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className='portal-skin-picker__swatches'>
                  {skin.preview.map((color) => (
                    <span
                      key={`${skin.key}-${color}`}
                      className='portal-skin-picker__swatch'
                      style={{ background: color }}
                    />
                  ))}
                </span>
                <span className='portal-skin-picker__copy'>
                  <strong>{skin.title}</strong>
                  <small>
                    {t(PORTAL_FAMILY_LABELS[skin.family])} ·{' '}
                    {t(PORTAL_MODE_LABELS[skin.mode])}
                  </small>
                </span>
                {active ? (
                  <span className='portal-skin-picker__check'>
                    <Check size={14} />
                  </span>
                ) : null}
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      }
    >
      <span className='portal-skin-picker'>
        <Button
          theme='outline'
          type='tertiary'
          icon={<Palette size={16} />}
          iconPosition='left'
          className='portal-skin-picker__trigger'
        >
          <span className='portal-skin-picker__trigger-copy'>
            <span>{t('皮肤')}</span>
            <strong>{selectedSkin.title}</strong>
          </span>
          <ChevronDown size={14} />
        </Button>
      </span>
    </Dropdown>
  );
};

export default PortalThemePicker;

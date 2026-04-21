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

import { Button } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PersonalSetting from '../settings/PersonalSetting';

const PortalAccountPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className='portal-page portal-account'>
      <section className='portal-page-head'>
        <div className='portal-page-head__main'>
          <div className='portal-page-head__eyebrow'>{t('账户与安全')}</div>
          <h1 className='portal-page-head__title'>
            {t('直接处理账户资料与安全设置')}
          </h1>
          <p className='portal-page-head__description'>
            {t('资料、密码、绑定和安全设置都在当前工作区完成。')}
          </p>
        </div>
        <div className='portal-page-head__actions'>
          <Button
            theme='solid'
            type='primary'
            icon={<ArrowRight size={16} />}
            onClick={() => navigate('/app/tokens')}
          >
            {t('返回令牌中心')}
          </Button>
        </div>
      </section>

      <section className='portal-embedded-workspace portal-embedded-workspace--account'>
        <PersonalSetting />
      </section>
    </div>
  );
};

export default PortalAccountPage;

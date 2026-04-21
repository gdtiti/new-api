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
import TokensPage from '../table/tokens';

const PortalTokensPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className='portal-page portal-tokens'>
      <section className='portal-page-head'>
        <div className='portal-page-head__main'>
          <div className='portal-page-head__eyebrow'>{t('令牌中心')}</div>
          <h1 className='portal-page-head__title'>{t('直接管理令牌')}</h1>
          <p className='portal-page-head__description'>
            {t('创建、启停、复制和查看令牌都在当前工作区完成。')}
          </p>
        </div>
        <div className='portal-page-head__actions'>
          <Button
            theme='solid'
            type='primary'
            icon={<ArrowRight size={16} />}
            onClick={() => navigate('/app/logs')}
          >
            {t('查看调用日志')}
          </Button>
        </div>
      </section>

      <section className='portal-embedded-workspace portal-embedded-workspace--tokens'>
        <TokensPage />
      </section>
    </div>
  );
};

export default PortalTokensPage;

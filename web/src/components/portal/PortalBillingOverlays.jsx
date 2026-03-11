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

import { Modal } from '@douyinfe/semi-ui';
import { renderQuotaWithAmount } from '../../helpers';
import PaymentConfirmModal from '../topup/modals/PaymentConfirmModal';
import TopupHistoryModal from '../topup/modals/TopupHistoryModal';

const CURRENCY_SYMBOL_MAP = {
  EUR: '€',
  USD: '$',
};

const PortalBillingOverlays = ({ billing }) => {
  if (!billing) {
    return null;
  }

  const selectedProduct = billing.selectedCreemProduct;
  const currencySymbol =
    CURRENCY_SYMBOL_MAP[selectedProduct?.currency] ||
    selectedProduct?.currency ||
    '$';

  return (
    <>
      <PaymentConfirmModal
        t={billing.t}
        open={billing.open}
        onlineTopUp={billing.onlineTopUp}
        handleCancel={billing.handleCancel}
        confirmLoading={billing.confirmLoading}
        topUpCount={billing.topUpCount}
        renderQuotaWithAmount={renderQuotaWithAmount}
        amountLoading={billing.amountLoading}
        renderAmount={billing.renderAmount}
        payWay={billing.payWay}
        payMethods={billing.payMethods}
        amountNumber={billing.amount}
        discountRate={billing.topupInfo?.discount?.[billing.topUpCount] || 1.0}
      />

      <TopupHistoryModal
        visible={billing.openHistory}
        onCancel={billing.handleHistoryCancel}
        t={billing.t}
      />

      <Modal
        title={billing.t('确认充值套餐')}
        visible={billing.creemOpen}
        onOk={billing.onlineCreemTopUp}
        onCancel={billing.handleCreemCancel}
        maskClosable={false}
        size='small'
        centered
        confirmLoading={billing.confirmLoading}
      >
        {selectedProduct && (
          <div className='portal-billing__creem-confirm'>
            <p>
              {billing.t('商品名称')}：{selectedProduct.name}
            </p>
            <p>
              {billing.t('价格')}：{currencySymbol}
              {selectedProduct.price}
            </p>
            <p>
              {billing.t('充值额度')}：{selectedProduct.quota}
            </p>
            <p>{billing.t('是否确认继续支付？')}</p>
          </div>
        )}
      </Modal>
    </>
  );
};

export default PortalBillingOverlays;

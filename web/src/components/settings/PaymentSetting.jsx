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

import React, { useEffect, useState } from 'react';
import { Banner, Card, Spin, Space, Tag } from '@douyinfe/semi-ui';
import SettingsGeneralPayment from '../../pages/Setting/Payment/SettingsGeneralPayment';
import SettingsPaymentGateway from '../../pages/Setting/Payment/SettingsPaymentGateway';
import SettingsPaymentGatewayStripe from '../../pages/Setting/Payment/SettingsPaymentGatewayStripe';
import SettingsPaymentGatewayCreem from '../../pages/Setting/Payment/SettingsPaymentGatewayCreem';
import { API, showError, toBoolean } from '../../helpers';
import { useTranslation } from 'react-i18next';

const PAY_METHOD_LABELS = {
  wxpay: '微信支付',
  alipay: '支付宝',
  qqpay: 'QQ 钱包',
  paypal: 'PayPal',
  stripe: 'Stripe',
  usdt: 'USDT',
};

const parsePayMethods = (rawPayMethods) => {
  if (!rawPayMethods) {
    return [];
  }

  try {
    const parsedPayMethods = JSON.parse(rawPayMethods);
    if (Array.isArray(parsedPayMethods)) {
      return parsedPayMethods
        .map((item) => {
          if (typeof item === 'string') {
            const methodType = item.trim();
            if (!methodType) {
              return null;
            }
            return {
              type: methodType,
              name: PAY_METHOD_LABELS[methodType] || methodType,
            };
          }

          if (!item || typeof item !== 'object') {
            return null;
          }

          const methodType =
            typeof item.type === 'string' ? item.type.trim() : '';
          const methodName =
            typeof item.name === 'string' ? item.name.trim() : '';

          if (!methodType && !methodName) {
            return null;
          }

          return {
            type: methodType || methodName,
            name: methodName || PAY_METHOD_LABELS[methodType] || methodType,
          };
        })
        .filter(Boolean);
    }
  } catch (error) {}

  return rawPayMethods
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((methodType) => ({
      type: methodType,
      name: PAY_METHOD_LABELS[methodType] || methodType,
    }));
};

const PaymentSetting = () => {
  const { t } = useTranslation();
  let [inputs, setInputs] = useState({
    ServerAddress: '',
    PayAddress: '',
    EpayId: '',
    EpayKey: '',
    Price: 7.3,
    MinTopUp: 1,
    TopupGroupRatio: '',
    CustomCallbackAddress: '',
    PayMethods: '',
    AmountOptions: '',
    AmountDiscount: '',

    StripeApiSecret: '',
    StripeWebhookSecret: '',
    StripePriceId: '',
    StripeUnitPrice: 8.0,
    StripeMinTopUp: 1,
    StripePromotionCodesEnabled: false,
  });

  let [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        switch (item.key) {
          case 'TopupGroupRatio':
            try {
              newInputs[item.key] = JSON.stringify(
                JSON.parse(item.value),
                null,
                2,
              );
            } catch (error) {
              console.error('解析TopupGroupRatio出错:', error);
              newInputs[item.key] = item.value;
            }
            break;
          case 'payment_setting.amount_options':
            try {
              newInputs['AmountOptions'] = JSON.stringify(
                JSON.parse(item.value),
                null,
                2,
              );
            } catch (error) {
              console.error('解析AmountOptions出错:', error);
              newInputs['AmountOptions'] = item.value;
            }
            break;
          case 'PayMethods':
            try {
              newInputs[item.key] = JSON.stringify(
                JSON.parse(item.value),
                null,
                2,
              );
            } catch (error) {
              console.error('解析PayMethods出错:', error);
              newInputs[item.key] = item.value;
            }
            break;
          case 'payment_setting.amount_discount':
            try {
              newInputs['AmountDiscount'] = JSON.stringify(
                JSON.parse(item.value),
                null,
                2,
              );
            } catch (error) {
              console.error('解析AmountDiscount出错:', error);
              newInputs['AmountDiscount'] = item.value;
            }
            break;
          case 'Price':
          case 'MinTopUp':
          case 'StripeUnitPrice':
          case 'StripeMinTopUp':
            newInputs[item.key] = parseFloat(item.value);
            break;
          default:
            if (item.key.endsWith('Enabled')) {
              newInputs[item.key] = toBoolean(item.value);
            } else {
              newInputs[item.key] = item.value;
            }
            break;
        }
      });

      setInputs(newInputs);
    } else {
      showError(t(message));
    }
  };

  async function onRefresh() {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError(t('刷新失败'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    onRefresh();
  }, []);

  const renderPayMethods = () => {
    const methods = parsePayMethods(inputs.PayMethods);

    if (methods.length === 0) {
      return <Tag color='red'>{t('未配置')}</Tag>;
    }

    return (
      <Space wrap>
        {methods.map((method, index) => (
          <Tag key={`${method.type}-${index}`} color='blue'>
            {method.name}
          </Tag>
        ))}
      </Space>
    );
  };

  return (
    <>
      <Spin spinning={loading} size='large'>
        <Banner
          fullMode={false}
          type='info'
          title={t('支付方式概览')}
          description={
            <div>
              {t('当前支付方式')}：{renderPayMethods()}
            </div>
          }
          style={{ marginTop: '10px' }}
        />
        <Card style={{ marginTop: '10px' }}>
          <SettingsGeneralPayment options={inputs} refresh={onRefresh} />
        </Card>
        <Card style={{ marginTop: '10px' }}>
          <SettingsPaymentGateway options={inputs} refresh={onRefresh} />
        </Card>
        <Card style={{ marginTop: '10px' }}>
          <SettingsPaymentGatewayStripe options={inputs} refresh={onRefresh} />
        </Card>
        <Card style={{ marginTop: '10px' }}>
          <SettingsPaymentGatewayCreem options={inputs} refresh={onRefresh} />
        </Card>
      </Spin>
    </>
  );
};

export default PaymentSetting;

import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCircleCheck, IconExclamationCircle, IconLock } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../contexts/ApiContext';
import { formatCurrency } from '../../defaults/formatters';
import { showApiErrorMessage } from '../../functions/notifications';
import { useUserState } from '../../states/UserState';

type OperationFieldConfig = {
  key: string;
  label: string;
  templateName: string;
  description: string;
  placeholder: string;
  inputType: 'date' | 'number';
  step?: string;
};

const OPERATION_FIELDS: OperationFieldConfig[] = [
  {
    key: 'sampleArrivalDate',
    label: '样品初次到店时间',
    templateName: '样品初次到店时间',
    description: '记录样品第一次到店时间，格式建议为 YYYY-MM-DD',
    placeholder: '2026-04-08',
    inputType: 'date'
  },
  {
    key: 'salePrice',
    label: '销售单价',
    templateName: '销售单价',
    description: '填写当前销售参考单价，默认按元理解',
    placeholder: '59',
    inputType: 'number',
    step: '0.01'
  },
  {
    key: 'douyinQuantity',
    label: '抖店上架数量',
    templateName: '抖店上架数量',
    description: '填写当前抖店在售数量',
    placeholder: '20',
    inputType: 'number',
    step: '1'
  },
  {
    key: 'wechatVideoQuantity',
    label: '视频号上架数量',
    templateName: '视频号上架数量',
    description: '填写当前视频号在售数量',
    placeholder: '10',
    inputType: 'number',
    step: '1'
  }
];

function extractList(data: any): any[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

function normalizeValue(value: string | null | undefined): string {
  return `${value ?? ''}`.trim();
}

function validateFieldValue(
  field: OperationFieldConfig,
  value: string
): string | null {
  if (!value) {
    return null;
  }

  if (field.inputType === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${field.label} 必须使用 YYYY-MM-DD 格式`;
    }

    return null;
  }

  if (Number.isNaN(Number(value))) {
    return `${field.label} 必须是数字`;
  }

  if (Number(value) < 0) {
    return `${field.label} 不能小于 0`;
  }

  if (field.step === '1' && !/^\d+$/.test(value)) {
    return `${field.label} 必须是整数`;
  }

  return null;
}

function formatSummaryText(value: string | null | undefined): string {
  return normalizeValue(value) || '未填写';
}

function formatSummaryInteger(value: string | null | undefined): string {
  const normalized = normalizeValue(value);

  if (!normalized) {
    return '未填写';
  }

  return normalized;
}

function formatSummaryCurrency(value: string | null | undefined): string {
  const normalized = normalizeValue(value);

  if (!normalized) {
    return '未填写';
  }

  const numericValue = Number(normalized);

  if (Number.isFinite(numericValue)) {
    return `${formatCurrency(numericValue, { currency: 'CNY' })}`;
  }

  return `${normalized} 元`;
}

function formatSummaryDate(value: string | null | undefined): string {
  const normalized = normalizeValue(value);

  if (!normalized) {
    return '未记录';
  }

  const parsedDate = dayjs(normalized);

  if (!parsedDate.isValid()) {
    return normalized;
  }

  return parsedDate.format('YYYY-MM-DD HH:mm');
}

function formatSummaryStock(
  quantity: number | string | null | undefined,
  unit?: string
): string {
  const numericValue = Number(quantity ?? 0);
  const displayValue = Number.isFinite(numericValue) ? numericValue : 0;
  const normalizedUnit = normalizeValue(unit);

  return normalizedUnit ? `${displayValue} ${normalizedUnit}` : `${displayValue}`;
}

function findLatestTrackingRecord(
  records: any[],
  deltaKey: 'added' | 'removed'
): any | null {
  return records.reduce<any | null>((latestRecord, record) => {
    const deltaValue = Number(record?.deltas?.[deltaKey] ?? 0);

    if (!(deltaValue > 0)) {
      return latestRecord;
    }

    if (!latestRecord) {
      return record;
    }

    const latestDate = dayjs(latestRecord?.date);
    const currentDate = dayjs(record?.date);

    if (!currentDate.isValid()) {
      return latestRecord;
    }

    if (!latestDate.isValid() || currentDate.isAfter(latestDate)) {
      return record;
    }

    return latestRecord;
  }, null);
}

function SummaryCard({
  label,
  value,
  hint
}: Readonly<{
  label: string;
  value: string;
  hint?: string;
}>) {
  return (
    <Paper withBorder p='md'>
      <Stack gap={6}>
        <Text size='xs' c='dimmed'>
          {label}
        </Text>
        <Text fw={600} lineClamp={2}>
          {value}
        </Text>
        {hint && (
          <Text size='xs' c='dimmed' lineClamp={2}>
            {hint}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

export default function PartOperationsPanel({
  partId,
  partLocked,
  totalInStock,
  unit
}: Readonly<{
  partId: number;
  partLocked?: boolean;
  totalInStock?: number;
  unit?: string;
}>) {
  const api = useApi();
  const user = useUserState();
  const canEdit = user.hasChangePermission(ModelType.part) && partLocked !== true;

  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ['operation-parameter-templates'],
    queryFn: async () =>
      api
        .get(apiUrl(ApiEndpoints.parameter_template_list), {
          params: {
            for_model: ModelType.part,
            enabled: true
          }
        })
        .then((response) => extractList(response.data)),
    refetchOnWindowFocus: false
  });

  const parametersQuery = useQuery({
    enabled: !!partId,
    queryKey: ['part-operation-parameters', partId],
    queryFn: async () =>
      api
        .get(apiUrl(ApiEndpoints.parameter_list), {
          params: {
            model_type: ModelType.part,
            model_id: partId,
            template_detail: true
          }
        })
        .then((response) => extractList(response.data)),
    refetchOnWindowFocus: false
  });

  const trackingSummaryQuery = useQuery({
    enabled: !!partId,
    queryKey: ['part-operation-tracking-summary', partId],
    queryFn: async () =>
      api
        .get(apiUrl(ApiEndpoints.stock_tracking_list), {
          params: {
            part: partId,
            limit: 50
          }
        })
        .then((response) => extractList(response.data)),
    refetchOnWindowFocus: false
  });

  const templateMap = useMemo(() => {
    const map = new Map<string, any>();

    for (const template of templatesQuery.data ?? []) {
      const templateName = normalizeValue(template?.name);

      if (templateName) {
        map.set(templateName, template);
      }
    }

    return map;
  }, [templatesQuery.data]);

  const parameterMap = useMemo(() => {
    const map = new Map<string, any>();

    for (const parameter of parametersQuery.data ?? []) {
      const templateName = normalizeValue(parameter?.template_detail?.name);

      if (templateName) {
        map.set(templateName, parameter);
      }
    }

    return map;
  }, [parametersQuery.data]);

  const missingTemplates = useMemo(() => {
    return OPERATION_FIELDS.filter((field) => !templateMap.has(field.templateName));
  }, [templateMap]);

  const latestInboundRecord = useMemo(() => {
    return findLatestTrackingRecord(trackingSummaryQuery.data ?? [], 'added');
  }, [trackingSummaryQuery.data]);

  const latestOutboundRecord = useMemo(() => {
    return findLatestTrackingRecord(trackingSummaryQuery.data ?? [], 'removed');
  }, [trackingSummaryQuery.data]);

  const summaryCards = useMemo(() => {
    return [
      {
        label: '样品初次到店时间',
        value: formatSummaryText(parameterMap.get('样品初次到店时间')?.data),
        hint: '用于确认产品第一次到店时间'
      },
      {
        label: '最近一次到店时间',
        value: formatSummaryDate(latestInboundRecord?.date),
        hint: latestInboundRecord?.notes
          ? `最近入库说明：${normalizeValue(latestInboundRecord.notes)}`
          : '依据最近一次入库流水自动汇总'
      },
      {
        label: '销售单价',
        value: formatSummaryCurrency(parameterMap.get('销售单价')?.data),
        hint: '默认按人民币展示'
      },
      {
        label: '当前库存数量',
        value: formatSummaryStock(totalInStock, unit),
        hint: '用于快速判断当前可用货量'
      },
      {
        label: '抖店上架数量',
        value: formatSummaryInteger(parameterMap.get('抖店上架数量')?.data),
        hint: '当前抖店在售数量'
      },
      {
        label: '视频号上架数量',
        value: formatSummaryInteger(parameterMap.get('视频号上架数量')?.data),
        hint: '当前视频号在售数量'
      },
      {
        label: '最近一次出库时间',
        value: formatSummaryDate(latestOutboundRecord?.date),
        hint: '用于核对最近一次扣减库存的时间'
      },
      {
        label: '最近一次出库说明',
        value: formatSummaryText(latestOutboundRecord?.notes),
        hint: '系统读取最近一次出库流水备注'
      }
    ];
  }, [latestInboundRecord, latestOutboundRecord, parameterMap, totalInStock, unit]);

  useEffect(() => {
    const nextValues: Record<string, string> = {};

    for (const field of OPERATION_FIELDS) {
      nextValues[field.key] = normalizeValue(
        parameterMap.get(field.templateName)?.data
      );
    }

    setDraftValues(nextValues);
  }, [parameterMap, partId]);

  const setDraftValue = (fieldKey: string, value: string | number | null) => {
    setDraftValues((current) => ({
      ...current,
      [fieldKey]: normalizeValue(value?.toString())
    }));
  };

  const resetDraftValues = () => {
    const nextValues: Record<string, string> = {};

    for (const field of OPERATION_FIELDS) {
      nextValues[field.key] = normalizeValue(
        parameterMap.get(field.templateName)?.data
      );
    }

    setDraftValues(nextValues);
  };

  const saveValues = async () => {
    if (missingTemplates.length > 0) {
      notifications.show({
        title: '字段尚未启用',
        message: '请先启用这些字段，再保存运营信息',
        color: 'red'
      });
      return;
    }

    const changedFields = OPERATION_FIELDS.filter((field) => {
      const currentValue = normalizeValue(
        parameterMap.get(field.templateName)?.data
      );
      const nextValue = normalizeValue(draftValues[field.key]);

      if (!currentValue && !nextValue) {
        return false;
      }

      return currentValue !== nextValue;
    });

    if (changedFields.length === 0) {
      notifications.show({
        title: '无需保存',
        message: '运营信息没有变化',
        color: 'blue'
      });
      return;
    }

    for (const field of changedFields) {
      const fieldValue = normalizeValue(draftValues[field.key]);
      const validationError = validateFieldValue(field, fieldValue);

      if (validationError) {
        notifications.show({
          title: '字段校验失败',
          message: validationError,
          color: 'red'
        });
        return;
      }
    }

    setSaving(true);

    try {
      for (const field of changedFields) {
        const template = templateMap.get(field.templateName);
        const parameter = parameterMap.get(field.templateName);
        const data = normalizeValue(draftValues[field.key]);

        if (parameter?.pk) {
          await api.patch(apiUrl(ApiEndpoints.parameter_list, parameter.pk), {
            data: data
          });
        } else if (data) {
          await api.post(apiUrl(ApiEndpoints.parameter_list), {
            template: template.pk,
            model_type: ModelType.part,
            model_id: partId,
            data: data
          });
        }
      }

      await parametersQuery.refetch();

      notifications.show({
        title: '保存成功',
        message: '运营信息已更新',
        color: 'green',
        icon: <IconCircleCheck />
      });
    } catch (error: any) {
      showApiErrorMessage({
        error: error,
        title: '保存运营信息失败',
        message: '请检查字段内容或稍后重试',
        id: 'part-operation-parameter-save-error'
      });
    } finally {
      setSaving(false);
    }
  };

  if (templatesQuery.isFetching || parametersQuery.isFetching) {
    return (
      <Group justify='center' py='xl'>
        <Loader size='sm' />
      </Group>
    );
  }

  if (templatesQuery.isError || parametersQuery.isError) {
    return (
      <Alert color='red' icon={<IconExclamationCircle />} title='运营信息加载失败'>
        无法读取运营信息，请刷新页面后重试。
      </Alert>
    );
  }

  return (
    <Stack gap='md'>
      <Paper withBorder p='md'>
        <Stack gap='sm'>
          <Group justify='space-between' align='center'>
            <Stack gap={2}>
              <Text fw={600}>业务摘要</Text>
              <Text size='sm' c='dimmed'>
                汇总产品常用运营字段和最近库存动作，便于业务快速判断。
              </Text>
            </Stack>
            {trackingSummaryQuery.isFetching && <Loader size='xs' />}
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing='sm'>
            {summaryCards.map((card) => (
              <SummaryCard
                key={card.label}
                label={card.label}
                value={card.value}
                hint={card.hint}
              />
            ))}
          </SimpleGrid>

          <Text size='xs' c='dimmed'>
            更完整的库存变动明细，请到“库存历史记录”页签查看。
          </Text>
        </Stack>
      </Paper>

      <Text size='sm' c='dimmed'>
        维护产品常用运营信息，保存后系统会自动更新对应业务字段。
      </Text>

      {partLocked && (
        <Alert color='orange' icon={<IconLock />} title='产品已锁定'>
          当前产品已锁定，运营信息只能查看，不能修改。
        </Alert>
      )}

      {missingTemplates.length > 0 && (
        <Alert
          color='red'
          icon={<IconExclamationCircle />}
          title='字段尚未启用'
        >
          <Stack gap='xs'>
            <Text size='sm'>
              以下字段当前未启用：{missingTemplates.map((field) => field.label).join('、')}
            </Text>
            <Text size='sm'>
              如需使用或扩展这些字段，请联系管理员在系统配置中新增并启用。
            </Text>
          </Stack>
        </Alert>
      )}

      {OPERATION_FIELDS.map((field) => {
        const hasTemplate = templateMap.has(field.templateName);
        const currentValue = normalizeValue(
          parameterMap.get(field.templateName)?.data
        );
        const value = draftValues[field.key] ?? '';

        return (
          <Paper key={field.key} withBorder p='md'>
            <Stack gap='xs'>
              <Group justify='space-between' align='flex-start'>
                <Stack gap={4}>
                  <Group gap='xs'>
                    <Text fw={600}>{field.label}</Text>
                    {hasTemplate ? (
                      <Badge color='green' variant='light'>
                        已启用
                      </Badge>
                    ) : (
                      <Badge color='red' variant='light'>
                        未启用
                      </Badge>
                    )}
                  </Group>
                  <Text size='sm' c='dimmed'>
                    {field.description}
                  </Text>
                  <Text size='xs' c='dimmed'>
                    当前值：{currentValue || '未填写'}
                  </Text>
                </Stack>
              </Group>

              <TextInput
                type={field.inputType}
                step={field.step}
                min={field.inputType === 'number' ? '0' : undefined}
                value={value}
                placeholder={field.placeholder}
                disabled={!canEdit || !hasTemplate || saving}
                onChange={(event) => {
                  setDraftValue(field.key, event.currentTarget.value);
                }}
              />
            </Stack>
          </Paper>
        );
      })}

      <Group justify='flex-end'>
        <Button
          variant='default'
          onClick={resetDraftValues}
          disabled={saving}
        >
          恢复已保存内容
        </Button>
        <Button
          color='green'
          onClick={saveValues}
          loading={saving}
          disabled={!canEdit || missingTemplates.length > 0}
        >
          保存全部
        </Button>
      </Group>
    </Stack>
  );
}

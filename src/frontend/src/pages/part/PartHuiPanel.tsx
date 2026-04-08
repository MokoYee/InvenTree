import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCircleCheck, IconExclamationCircle, IconLock } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../contexts/ApiContext';
import { showApiErrorMessage } from '../../functions/notifications';
import { useUserState } from '../../states/UserState';

type HuiFieldConfig = {
  key: string;
  label: string;
  templateName: string;
  description: string;
  placeholder: string;
  inputType: 'date' | 'number';
  step?: string;
};

const HUI_FIELDS: HuiFieldConfig[] = [
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

function validateFieldValue(field: HuiFieldConfig, value: string): string | null {
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

export default function PartHuiPanel({
  partId,
  partLocked
}: Readonly<{
  partId: number;
  partLocked?: boolean;
}>) {
  const api = useApi();
  const user = useUserState();
  const canEdit = user.hasChangePermission(ModelType.part) && partLocked !== true;

  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ['hui-parameter-templates'],
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
    queryKey: ['hui-part-parameters', partId],
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
    return HUI_FIELDS.filter((field) => !templateMap.has(field.templateName));
  }, [templateMap]);

  useEffect(() => {
    const nextValues: Record<string, string> = {};

    for (const field of HUI_FIELDS) {
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

    for (const field of HUI_FIELDS) {
      nextValues[field.key] = normalizeValue(
        parameterMap.get(field.templateName)?.data
      );
    }

    setDraftValues(nextValues);
  };

  const saveValues = async () => {
    if (missingTemplates.length > 0) {
      notifications.show({
        title: '一期模板未初始化',
        message: '请先执行 hui_bootstrap --force，再回来保存这些字段',
        color: 'red'
      });
      return;
    }

    const changedFields = HUI_FIELDS.filter((field) => {
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
        message: '一期运营字段没有变化',
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
        message: '一期运营字段已更新',
        color: 'green',
        icon: <IconCircleCheck />
      });
    } catch (error: any) {
      showApiErrorMessage({
        error: error,
        title: '保存一期运营字段失败',
        message: '请检查字段内容或稍后重试',
        id: 'hui-parameter-save-error'
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
      <Alert color='red' icon={<IconExclamationCircle />} title='一期字段加载失败'>
        无法读取一期运营字段，请刷新页面后重试。
      </Alert>
    );
  }

  return (
    <Stack gap='md'>
      <Alert color='blue' icon={<IconCircleCheck />} title='一期运营字段'>
        这里是 Hui 一期直接可用的 4 个业务字段，不需要再去完整参数表里手动新增。
      </Alert>

      {partLocked && (
        <Alert color='orange' icon={<IconLock />} title='零件已锁定'>
          当前零件已锁定，一期运营字段只能查看，不能修改。
        </Alert>
      )}

      {missingTemplates.length > 0 && (
        <Alert
          color='red'
          icon={<IconExclamationCircle />}
          title='缺少一期参数模板'
        >
          <Stack gap='xs'>
            <Text size='sm'>
              未检测到以下模板：{missingTemplates.map((field) => field.label).join('、')}
            </Text>
            <Text size='sm'>
              请执行 `hui_bootstrap --force` 后刷新本页。
            </Text>
          </Stack>
        </Alert>
      )}

      {HUI_FIELDS.map((field) => {
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
                        缺少模板
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
          恢复当前值
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

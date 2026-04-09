import { Badge, Group, Text } from '@mantine/core';
import { IconUser, IconUsersGroup } from '@tabler/icons-react';
import type { ReactNode } from 'react';

import { t } from '@lingui/core/macro';
import {
  getPrimaryUserLabel,
  getSecondaryUserLabel
} from '../../functions/userDisplay';
import { type InstanceRenderInterface, RenderInlineModel } from './Instance';

export function RenderOwner({
  instance
}: Readonly<InstanceRenderInterface>): ReactNode {
  return (
    instance && (
      <RenderInlineModel
        primary={instance.name}
        suffix={
          instance.label == 'group' ? (
            <IconUsersGroup size={16} />
          ) : (
            <IconUser size={16} />
          )
        }
      />
    )
  );
}

export function RenderUser({
  instance
}: Readonly<InstanceRenderInterface>): ReactNode {
  const primaryLabel = getPrimaryUserLabel(
    instance?.username,
    instance?.first_name,
    instance?.last_name
  );
  const secondaryLabel = getSecondaryUserLabel(
    instance?.username,
    instance?.first_name,
    instance?.last_name
  );

  return (
    instance && (
      <RenderInlineModel
        primary={primaryLabel}
        secondary={
          <Group gap='xs'>
            {secondaryLabel && <Text size='xs'>{secondaryLabel}</Text>}
            {instance.is_active === false && (
              <Badge autoContrast color='red'>{t`Inactive`}</Badge>
            )}
          </Group>
        }
        suffix={
          <Group gap='xs'>
            <IconUser size={16} />
          </Group>
        }
      />
    )
  );
}

export function RenderGroup({
  instance
}: Readonly<InstanceRenderInterface>): ReactNode {
  return instance && <RenderInlineModel primary={instance.name} />;
}

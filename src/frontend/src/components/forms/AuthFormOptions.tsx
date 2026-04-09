import { Center, Group } from '@mantine/core';
import { ColorToggle } from '../items/ColorToggle';
import { LanguageToggle } from '../items/LanguageToggle';

export function AuthFormOptions({
  hostname,
  toggleHostEdit
}: Readonly<{
  hostname: string;
  toggleHostEdit: () => void;
}>) {
  void hostname;
  void toggleHostEdit;

  return (
    <Center mx={'md'}>
      <Group>
        <ColorToggle />
        <LanguageToggle />
        {/* 登录页不展示服务器切换入口，避免暴露实例信息给业务用户。
        {window.INVENTREE_SETTINGS.show_server_selector && (
          <Tooltip label={hostname}>
            <ActionIcon
              size='lg'
              variant='transparent'
              onClick={toggleHostEdit}
            >
              <IconServer />
            </ActionIcon>
          </Tooltip>
        )}
        <Text c={'dimmed'}>
          {server.version} | {server.apiVersion}
        </Text>
        */}
      </Group>
    </Center>
  );
}

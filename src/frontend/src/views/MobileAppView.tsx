import { Trans } from '@lingui/react/macro';
import { Center, Container, Stack, Text, Title } from '@mantine/core';

import { useShallow } from 'zustand/react/shallow';
import { ThemeContext } from '../contexts/ThemeContext';
import { IS_DEV } from '../main';
import { useLocalState } from '../states/LocalState';

export default function MobileAppView() {
  const [setAllowMobile] = useLocalState(
    useShallow((state) => [state.setAllowMobile])
  );

  function ignore() {
    setAllowMobile(true);
    window.location.reload();
  }
  return (
    <ThemeContext>
      <Center h='100vh'>
        <Container>
          <Stack>
            <Title c='red'>
              <Trans>Mobile access notice</Trans>
            </Title>
            <Text>
              <Trans>
                You can handle daily lookup and simple data entry on your
                phone. For bulk maintenance or complex setup, a computer is
                recommended for a smoother workflow.
              </Trans>
            </Text>
            {(IS_DEV ||
              window.INVENTREE_SETTINGS.mobile_mode === 'allow-ignore') && (
              <Text
                onClick={ignore}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
              >
                <Trans>Continue to the system</Trans>
              </Text>
            )}
          </Stack>
        </Container>
      </Center>
    </ThemeContext>
  );
}

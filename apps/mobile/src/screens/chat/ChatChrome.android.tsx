import { useRef, useState, type ReactElement } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { Host } from '@expo/ui';
import {
  AssistChip,
  Column,
  FilledIconButton,
  FlowRow,
  Icon,
  IconButton,
  LoadingIndicator,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedTextField,
  RNHostView,
  Row,
  Text,
  useMaterialColors,
  useNativeState,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, height, imePadding, padding, Shapes, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import Close from '../../../assets/icons/close_fill.xml';
import Send from '../../../assets/icons/send_fill.xml';
import Tune from '../../../assets/icons/tune_fill.xml';
import WandShine from '../../../assets/icons/wand_shine_fill.xml';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import type { ChatChromeProps, ChatEntry } from './ChatScreen';

const BUBBLE_INSET = 48;
const SHEET_SHARE = 0.85;

function Bubble({ text, mine, m }: { text: string; mine: boolean; m: MaterialColors }) {
  return (
    <Row horizontalArrangement={mine ? 'end' : 'start'} modifiers={[fillMaxWidth(), padding(mine ? BUBBLE_INSET : 0, 0, mine ? 0 : BUBBLE_INSET, 0)]}>
      <Column
        modifiers={[
          clip(Shapes.RoundedCorner(20)),
          background(mine ? m.primary : m.surfaceContainerHighest),
          padding(14, 10, 14, 10)
        ]}
      >
        <Text color={mine ? m.onPrimary : m.onSurface} style={m3Text('bodyLarge')}>{text}</Text>
      </Column>
    </Row>
  );
}

function Block({ scheme, children }: { scheme: 'light' | 'dark'; children: ReactElement }) {
  return (
    <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
      {children}
    </Host>
  );
}

function Entry({ entry, m, pending, onSend, onChip }: { entry: ChatEntry; m: MaterialColors; pending: boolean; onSend: (text: string) => void; onChip: (field: string) => void }) {
  if (entry.role === 'user') return <Bubble text={entry.text} mine m={m} />;
  return (
    <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
      <Bubble text={entry.text} mine={false} m={m} />
      {entry.chips.length ? (
        <FlowRow horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
          {entry.chips.map((chip) => (
            <AssistChip key={chip.field} onClick={() => onChip(chip.field)}>
              <AssistChip.LeadingIcon>
                <Icon source={Tune} size={18} />
              </AssistChip.LeadingIcon>
              <AssistChip.Label>
                <Text style={m3Text('labelLarge')}>{chip.label}</Text>
              </AssistChip.Label>
            </AssistChip>
          ))}
        </FlowRow>
      ) : null}
      {entry.questions.map((question) => <Bubble key={question} text={question} mine={false} m={m} />)}
      {entry.replies.length ? (
        <FlowRow horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
          {entry.replies.map((reply) => (
            <OutlinedButton key={reply} enabled={!pending} onClick={() => onSend(reply)}>
              <Text style={m3Text('labelLarge')}>{reply}</Text>
            </OutlinedButton>
          ))}
        </FlowRow>
      ) : null}
    </Column>
  );
}

export function ChatChrome({ colors, entries, pending, error, onSend, onChip, onClose }: ChatChromeProps) {
  const scheme = colors.scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });
  const { height: windowHeight } = useWindowDimensions();
  const scroll = useRef<ScrollViewInstance>(null);
  const value = useNativeState('');
  const [text, setText] = useState('');
  const canSend = !pending && text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    value.set('');
    setText('');
  };

  return (
    <Host matchContents colorScheme={scheme} seedColor={materialSeedColor} style={styles.host}>
      <ModalBottomSheet onDismissRequest={onClose} skipPartiallyExpanded containerColor={m.surfaceContainerLow}>
        <Column modifiers={[fillMaxWidth(), height(Math.round(windowHeight * SHEET_SHARE)), imePadding()]}>
          <Row horizontalArrangement={{ spacedBy: 12 }} verticalAlignment="center" modifiers={[fillMaxWidth(), padding(20, 0, 8, 12)]}>
            <Column
              horizontalAlignment="center"
              verticalArrangement="center"
              modifiers={[size(40, 40), clip(Shapes.Circle), background(m.primaryContainer)]}
            >
              <Icon source={WandShine} size={22} tint={m.onPrimaryContainer} />
            </Column>
            <Column modifiers={[weight(1)]}>
              <Text color={m.onSurface} style={m3Text('titleLarge')}>Trip agent</Text>
              <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>Replies edit your trip</Text>
            </Column>
            <IconButton onClick={onClose}>
              <Icon source={Close} size={24} contentDescription="Close" />
            </IconButton>
          </Row>
          <RNHostView modifiers={[fillMaxWidth(), weight(1)]}>
            <ScrollView
              ref={scroll}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardDismissMode="on-drag"
              onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
            >
              {entries.length === 0 ? (
                <Block scheme={scheme}>
                  <Text color={m.onSurfaceVariant} style={m3Text('bodyLarge')}>
                    Tell the agent about your trip, like &quot;cheap, walk at most 10 min, to Harvard&quot;.
                  </Text>
                </Block>
              ) : null}
              {entries.map((entry) => (
                <Block key={entry.id} scheme={scheme}>
                  <Entry entry={entry} m={m} pending={pending} onSend={onSend} onChip={onChip} />
                </Block>
              ))}
              {pending ? (
                <Block scheme={scheme}>
                  <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
                    <LoadingIndicator modifiers={[size(32, 32)]} />
                    <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>Thinking…</Text>
                  </Row>
                </Block>
              ) : null}
              {error ? (
                <Block scheme={scheme}>
                  <Column modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(16)), background(m.errorContainer), padding(14, 10, 14, 10)]}>
                    <Text color={m.onErrorContainer} style={m3Text('bodyMedium')}>{error}</Text>
                  </Column>
                </Block>
              ) : null}
            </ScrollView>
          </RNHostView>
          <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 8, 16, 16)]}>
            <OutlinedTextField
              value={value}
              onValueChange={setText}
              singleLine
              keyboardOptions={{ capitalization: 'sentences', imeAction: 'send' }}
              keyboardActions={{ onSend: submit }}
              modifiers={[weight(1)]}
            >
              <OutlinedTextField.Placeholder>
                <Text style={m3Text('bodyLarge')}>Ask about your trip</Text>
              </OutlinedTextField.Placeholder>
            </OutlinedTextField>
            <FilledIconButton enabled={canSend} onClick={submit}>
              <Icon source={Send} size={24} contentDescription="Send" />
            </FilledIconButton>
          </Row>
        </Column>
      </ModalBottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute' },
  fullWidth: { width: '100%' },
  list: { flex: 1 },
  listContent: { gap: 12, paddingHorizontal: 16, paddingVertical: 8 }
});

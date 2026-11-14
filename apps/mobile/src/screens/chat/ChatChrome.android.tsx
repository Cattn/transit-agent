import { useState } from 'react';
import { StyleSheet } from 'react-native';
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
  Row,
  Text,
  useMaterialColors,
  useNativeState,
  type MaterialColors
} from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxHeight, fillMaxWidth, imePadding, padding, Shapes, size, verticalScroll, weight } from '@expo/ui/jetpack-compose/modifiers';
import Close from '../../../assets/icons/close_fill.xml';
import Send from '../../../assets/icons/send_fill.xml';
import Tune from '../../../assets/icons/tune_fill.xml';
import WandShine from '../../../assets/icons/wand_shine_fill.xml';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import type { ChatChromeProps, ChatEntry } from './ChatScreen';

const BUBBLE_INSET = 48;

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
        <Column modifiers={[fillMaxWidth(), fillMaxHeight(0.92), imePadding()]}>
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
          <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), weight(1), verticalScroll(), padding(16, 8, 16, 8)]}>
            {entries.length === 0 ? (
              <Text color={m.onSurfaceVariant} style={m3Text('bodyLarge')}>
                Tell the agent about your trip, like &quot;cheap, walk at most 10 min, to Harvard&quot;.
              </Text>
            ) : null}
            {entries.map((entry) => <Entry key={entry.id} entry={entry} m={m} pending={pending} onSend={onSend} onChip={onChip} />)}
            {pending ? (
              <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
                <LoadingIndicator modifiers={[size(32, 32)]} />
                <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>Thinking…</Text>
              </Row>
            ) : null}
            {error ? (
              <Column modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(16)), background(m.errorContainer), padding(14, 10, 14, 10)]}>
                <Text color={m.onErrorContainer} style={m3Text('bodyMedium')}>{error}</Text>
              </Column>
            ) : null}
          </Column>
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
  host: { position: 'absolute' }
});

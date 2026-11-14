import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppColors } from '../../theme/colors';
import type { ChatChromeProps, ChatEntry } from './ChatScreen';

function Bubble({ text, mine, colors }: { text: string; mine: boolean; colors: AppColors }) {
  return (
    <View style={[styles.bubble, mine ? [styles.mine, { backgroundColor: colors.primary }] : { backgroundColor: colors.surfaceVariant }]}>
      <Text style={[styles.bubbleText, { color: mine ? colors.onPrimary : colors.onSurface }]}>{text}</Text>
    </View>
  );
}

function Entry({ entry, colors, pending, onSend, onChip }: { entry: ChatEntry; colors: AppColors; pending: boolean; onSend: (text: string) => void; onChip: (field: string) => void }) {
  if (entry.role === 'user') return <Bubble text={entry.text} mine colors={colors} />;
  return (
    <View style={styles.entry}>
      <Bubble text={entry.text} mine={false} colors={colors} />
      {entry.chips.length ? (
        <View style={styles.wrap}>
          {entry.chips.map((chip) => (
            <Pressable key={chip.field} accessibilityRole="button" onPress={() => onChip(chip.field)} style={[styles.chip, { backgroundColor: colors.secondaryContainer }]}>
              <Text style={[styles.chipText, { color: colors.onSecondaryContainer }]}>{chip.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {entry.questions.map((question) => <Bubble key={question} text={question} mine={false} colors={colors} />)}
      {entry.replies.length ? (
        <View style={styles.wrap}>
          {entry.replies.map((reply) => (
            <Pressable
              key={reply}
              accessibilityRole="button"
              disabled={pending}
              onPress={() => onSend(reply)}
              style={[styles.reply, { borderColor: colors.primary }]}
            >
              <Text style={[styles.chipText, { color: colors.primary }]}>{reply}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ChatChrome({ colors, entries, pending, error, onSend, onChip, onClose }: ChatChromeProps) {
  const insets = useSafeAreaInsets();
  const dark = colors.scheme === 'dark';
  const scroll = useRef<ScrollViewInstance>(null);
  const [text, setText] = useState('');
  const canSend = !pending && text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close agent chat" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} />
      <KeyboardAvoidingView behavior="padding" style={[styles.sheet, { top: insets.top + 48 }]}>
        <BlurView intensity={90} tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} style={styles.glass}>
          <View style={[styles.grabber, { backgroundColor: colors.outline }]} />
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.sparkle, { color: colors.onPrimaryContainer }]}>✦</Text>
            </View>
            <View style={styles.titles}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.onSurface }]}>Trip agent</Text>
              <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Replies edit your trip</Text>
            </View>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
              <Text style={[styles.done, { color: colors.primary }]}>Done</Text>
            </Pressable>
          </View>
          <ScrollView
            ref={scroll}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardDismissMode="interactive"
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          >
            {entries.length === 0 ? (
              <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>
                Tell the agent about your trip, like &quot;cheap, walk at most 10 min, to Harvard&quot;.
              </Text>
            ) : null}
            {entries.map((entry) => <Entry key={entry.id} entry={entry} colors={colors} pending={pending} onSend={onSend} onChip={onChip} />)}
            {pending ? <ActivityIndicator style={styles.pending} color={colors.onSurfaceVariant} /> : null}
            {error ? (
              <View style={[styles.error, { backgroundColor: colors.errorContainer }]}>
                <Text style={[styles.bubbleText, { color: colors.onErrorContainer }]}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>
          <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Ask about your trip"
              placeholderTextColor={colors.onSurfaceVariant}
              returnKeyType="send"
              onSubmitEditing={submit}
              style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceVariant }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              onPress={submit}
              style={[styles.send, { backgroundColor: colors.primary, opacity: canSend ? 1 : 0.4 }]}
            >
              <Text style={[styles.sendIcon, { color: colors.onPrimary }]}>↑</Text>
            </Pressable>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  glass: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginTop: 8, opacity: 0.5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sparkle: { fontSize: 20 },
  titles: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  done: { fontSize: 17, fontWeight: '600' },
  list: { flex: 1 },
  listContent: { gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  hint: { fontSize: 16 },
  entry: { gap: 8 },
  bubble: { maxWidth: '82%', alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: 'flex-end' },
  bubbleText: { fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  reply: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: '600' },
  pending: { alignSelf: 'flex-start' },
  error: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 20, fontWeight: '700' }
});

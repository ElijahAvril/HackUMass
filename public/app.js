import { SpeechToTextClient } from "./speech-to-text-client.js";
import {
  completeReminder,
  firebaseConfigured,
  initializeFirebase,
  removeReminder,
  saveReminder,
  signInWithGoogle,
  signOutUser,
  watchReminders
} from "./firebase-service.js";

const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const clearButton = document.querySelector("#clear");
const status = document.querySelector("#status");
const transcript = document.querySelector("#transcript");
const playback = document.querySelector("#playback");
const playbackEmpty = document.querySelector("#playback-empty");
const firebaseStatus = document.querySelector("#firebase-status");
const accountControls = document.querySelector("#account-controls");
const signInButton = document.querySelector("#sign-in");
const signOutButton = document.querySelector("#sign-out");
const accountEmail = document.querySelector("#account-email");
const interpretButton = document.querySelector("#interpret");
const reminderMessage = document.querySelector("#reminder-message");
const proposalSection = document.querySelector("#proposal-section");
const proposalForm = document.querySelector("#proposal-form");
const reminderTitle = document.querySelector("#reminder-title");
const reminderNotes = document.querySelector("#reminder-notes");
const reminderDue = document.querySelector("#reminder-due");
const saveReminderButton = document.querySelector("#save-reminder");
const cancelProposalButton = document.querySelector("#cancel-proposal");
const remindersList = document.querySelector("#reminders-list");
const remindersEmpty = document.querySelector("#reminders-empty");
const assistantEnabled = document.querySelector("#assistant-enabled");
const assistantStatus = document.querySelector("#assistant-status");
const assistantReply = document.querySelector("#assistant-reply");
const assistantTitle = document.querySelector("#assistant-title");
const assistantItems = document.querySelector("#assistant-items");
const transcripts = [];
const completedChecklistItems = new Set();
let interimTranscript = "";
let playbackUrl;
let currentUser;
let reminderTimeZone;
let proposedTranscript = "";
let unsubscribeReminders;
let interpreting = false;
let assistantDraft = { title: "", items: [] };
let assistantTimer;
let assistantRequestVersion = 0;
let assistantRequestPending = false;
let assistantShouldInterpret = false;
let pendingAssistantThoughtComplete = false;
const ASSISTANT_PAUSE_MS = 1500;

function renderTranscript() {
  const text = [...transcripts, interimTranscript].filter(Boolean).join("\n");
  transcript.textContent = text || "Your transcript will appear here.";
  interpretButton.disabled =
    !currentUser || transcripts.length === 0 || interpreting;
}

function renderAssistantDraft(draft) {
  assistantReply.textContent = draft.reply ?? "";
  assistantTitle.textContent = draft.title;
  assistantItems.replaceChildren();

  for (const item of draft.items) {
    const row = document.createElement("li");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("aria-label", `Mark ${item.text} complete`);
    const itemKey = item.text.trim().toLocaleLowerCase();
    checkbox.checked = completedChecklistItems.has(itemKey);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        completedChecklistItems.add(itemKey);
      } else {
        completedChecklistItems.delete(itemKey);
      }
    });
    const text = document.createElement("span");
    text.textContent = item.text;
    row.append(checkbox, text);

    if (item.dueAt) {
      const due = document.createElement("span");
      due.className = "due-date";
      const date = new Date(item.dueAt);
      due.textContent = Number.isFinite(date.getTime())
        ? `Check off by ${new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
          }).format(date)}`
        : "";
      row.append(due);
    }
    assistantItems.append(row);
  }
}

function scheduleAssistantInterpretation(thoughtComplete = false) {
  if (!assistantEnabled.checked || transcripts.length === 0) {
    return;
  }

  clearTimeout(assistantTimer);
  assistantRequestVersion += 1;
  assistantShouldInterpret = true;
  pendingAssistantThoughtComplete = thoughtComplete;
  assistantStatus.textContent = "Listening for the rest of your thought...";
  assistantTimer = setTimeout(() => {
    void interpretConversation(assistantRequestVersion);
  }, ASSISTANT_PAUSE_MS);
}

async function interpretConversation(requestVersion) {
  if (assistantRequestPending) {
    assistantTimer = setTimeout(() => {
      void interpretConversation(requestVersion);
    }, ASSISTANT_PAUSE_MS);
    return;
  }

  assistantRequestPending = true;
  const thoughtComplete = pendingAssistantThoughtComplete;
  pendingAssistantThoughtComplete = false;
  assistantShouldInterpret = false;
  assistantStatus.textContent = "Updating your temporary draft...";

  try {
    const response = await fetch("/api/assistant/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: transcripts.join(" ").trim().slice(-5000),
        draft: { title: assistantDraft.title, items: assistantDraft.items },
        now: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        isFinal: thoughtComplete
      })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? "Could not update the assistant draft.");
    }
    if (requestVersion !== assistantRequestVersion) {
      return;
    }

    assistantDraft = result.assistant;
    renderAssistantDraft(assistantDraft);
    assistantStatus.textContent = thoughtComplete
      ? "Idea complete. Keep talking to make a follow-up or correction."
      : assistantDraft.clarification || "Draft updated. Keep talking to revise it.";
  } catch (error) {
    if (requestVersion === assistantRequestVersion) {
      assistantStatus.textContent = `Could not update the draft: ${error.message}`;
    }
  } finally {
    assistantRequestPending = false;
    if (
      requestVersion !== assistantRequestVersion &&
      assistantEnabled.checked &&
      assistantShouldInterpret
    ) {
      clearTimeout(assistantTimer);
      assistantTimer = setTimeout(() => {
        void interpretConversation(assistantRequestVersion);
      }, ASSISTANT_PAUSE_MS);
    }
  }
}

function setReminderMessage(message, isError = false) {
  reminderMessage.textContent = message;
  reminderMessage.dataset.error = String(isError);
}

function toLocalDateTimeValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function setCurrentTimeMinimum() {
  reminderDue.min = toLocalDateTimeValue(new Date().toISOString());
}

function formatDueDate(timestamp) {
  const date = timestamp?.toDate?.();
  return date
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date)
    : "Saving date...";
}

function renderReminders(reminders) {
  remindersList.replaceChildren();
  remindersEmpty.hidden = reminders.length > 0;
  if (reminders.length === 0) {
    remindersEmpty.textContent = currentUser
      ? "No reminders saved yet."
      : "Sign in to see reminders saved to your account.";
    return;
  }

  for (const reminder of reminders) {
    const item = document.createElement("li");
    item.className = "reminder-card";
    const heading = document.createElement("h3");
    heading.textContent = reminder.title;
    const due = document.createElement("p");
    due.textContent = formatDueDate(reminder.dueAt);
    const notes = document.createElement("p");
    notes.textContent = reminder.notes || "";
    item.append(heading, due);
    if (reminder.notes) {
      item.append(notes);
    }

    const actions = document.createElement("div");
    actions.className = "controls";
    if (reminder.status !== "done") {
      const completeButton = document.createElement("button");
      completeButton.className = "secondary";
      completeButton.type = "button";
      completeButton.textContent = "Mark done";
      completeButton.addEventListener("click", async () => {
        completeButton.disabled = true;
        try {
          await completeReminder(currentUser, reminder.id);
        } catch (error) {
          firebaseStatus.textContent = `Could not update reminder: ${error.message}`;
        } finally {
          completeButton.disabled = false;
        }
      });
      actions.append(completeButton);
    } else {
      const done = document.createElement("span");
      done.textContent = "Completed";
      actions.append(done);
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "secondary";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      deleteButton.disabled = true;
      try {
        await removeReminder(currentUser, reminder.id);
      } catch (error) {
        firebaseStatus.textContent = `Could not delete reminder: ${error.message}`;
      } finally {
        deleteButton.disabled = false;
      }
    });
    actions.append(deleteButton);
    item.append(actions);
    remindersList.append(item);
  }
}

function handleAuthState(user) {
  currentUser = user;
  signInButton.hidden = Boolean(user);
  signOutButton.hidden = !user;
  accountEmail.textContent = user?.email ?? "";
  firebaseStatus.textContent = user
    ? `Signed in as ${user.email ?? "Google account"}. Reminders are saved to your account.`
    : "Sign in with Google to interpret and save reminders.";

  unsubscribeReminders?.();
  unsubscribeReminders = undefined;
  renderReminders([]);
  renderTranscript();
  if (user) {
    unsubscribeReminders = watchReminders(
      user,
      renderReminders,
      (error) => {
        firebaseStatus.textContent = `Could not load reminders: ${error.message}`;
      }
    );
  }
}

const client = new SpeechToTextClient({
  onStatus(message) {
    status.textContent = message;
    status.dataset.error = "false";
  },
  onError(error) {
    status.textContent = error.message;
    status.dataset.error = "true";
  },
  onEvent(event) {
    if (event.type === "speech_to_text.interim_transcript") {
      interimTranscript = event.text ?? "";
      clearTimeout(assistantTimer);
      assistantRequestVersion += 1;
      assistantShouldInterpret = false;
      renderTranscript();
    } else if (event.type === "speech_to_text.transcript") {
      if (event.text) {
        transcripts.push(event.text);
        const donePhrase = /\b(?:i['’]?m done|that['’]?s all|finish(?:ed)? the idea)\b[.! ]*$/i;
        const thoughtComplete = donePhrase.test(event.text.trim());
        if (thoughtComplete) {
          transcripts[transcripts.length - 1] = event.text.replace(donePhrase, "").trim();
        }
        scheduleAssistantInterpretation(thoughtComplete);
      }
      interimTranscript = "";
      renderTranscript();
      status.textContent = "Listening. Keep speaking or stop when you are finished.";
    } else if (event.type === "error") {
      client.onError(
        new Error(event.message ?? event.error?.message ?? "Speech service error.")
      );
    }
  }
});

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  try {
    await client.start();
    stopButton.disabled = false;
    clearButton.disabled = false;
  } catch (error) {
    status.textContent = error.message;
    status.dataset.error = "true";
  } finally {
    if (stopButton.disabled) {
      startButton.disabled = false;
    }
  }
});

stopButton.addEventListener("click", async () => {
  stopButton.disabled = true;
  try {
    const recording = await client.stop();
    if (recording.size > 44) {
      if (playbackUrl) {
        URL.revokeObjectURL(playbackUrl);
      }
      playbackUrl = URL.createObjectURL(recording);
      playback.src = playbackUrl;
      playback.hidden = false;
      playbackEmpty.hidden = true;
      status.textContent = "Microphone stopped. Your transcript and draft remain in this browser.";
    } else {
      status.textContent = "No audio was captured. Try recording again.";
      status.dataset.error = "true";
    }
  } catch (error) {
    status.textContent = error.message;
    status.dataset.error = "true";
  } finally {
    startButton.disabled = false;
  }
});

clearButton.addEventListener("click", () => {
  clearTimeout(assistantTimer);
  assistantRequestVersion += 1;
  transcripts.length = 0;
  interimTranscript = "";
  assistantDraft = { title: "", items: [] };
  completedChecklistItems.clear();
  assistantShouldInterpret = false;
  pendingAssistantThoughtComplete = false;
  renderAssistantDraft({ reply: "", ...assistantDraft });
  assistantStatus.textContent = "Start talking to build a temporary draft.";
  renderTranscript();
  status.textContent = "Transcript cleared.";
});

assistantEnabled.addEventListener("change", () => {
  clearTimeout(assistantTimer);
  assistantRequestVersion += 1;
  if (assistantEnabled.checked && transcripts.length > 0) {
    scheduleAssistantInterpretation();
  } else {
    assistantShouldInterpret = false;
    assistantStatus.textContent = assistantEnabled.checked
      ? "Start talking to build a temporary draft."
      : "Live interpretation is paused.";
  }
});

signInButton.addEventListener("click", async () => {
  signInButton.disabled = true;
  try {
    await signInWithGoogle();
  } catch (error) {
    firebaseStatus.textContent = `Sign-in failed: ${error.message}`;
  } finally {
    signInButton.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  try {
    await signOutUser();
  } catch (error) {
    firebaseStatus.textContent = `Sign-out failed: ${error.message}`;
  }
});

interpretButton.addEventListener("click", async () => {
  if (!currentUser || transcripts.length === 0 || interpreting) {
    return;
  }

  interpreting = true;
  renderTranscript();
  setReminderMessage("Interpreting the latest transcript...");
  proposalSection.hidden = true;
  try {
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/reminders/interpret", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        transcript: transcripts[transcripts.length - 1],
        now: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? "Could not interpret this transcript.");
    }

    const proposal = result.proposal;
    if (!proposal.isReminder) {
      setReminderMessage(
        proposal.clarification ||
          "I could not identify a clear reminder date and time. Try saying the task and when it is due."
      );
      return;
    }

    reminderTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    proposedTranscript = transcripts[transcripts.length - 1];
    reminderTitle.value = proposal.title;
    reminderNotes.value = proposal.notes;
    reminderDue.value = toLocalDateTimeValue(proposal.dueAt);
    setCurrentTimeMinimum();
    proposalSection.hidden = false;
    setReminderMessage("Review the proposed reminder and confirm it to save.");
  } catch (error) {
    setReminderMessage(error.message, true);
  } finally {
    interpreting = false;
    renderTranscript();
  }
});

proposalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !proposalForm.reportValidity()) {
    return;
  }

  const dueAt = new Date(reminderDue.value);
  if (!Number.isFinite(dueAt.getTime()) || dueAt <= new Date()) {
    setReminderMessage("Choose a date and time in the future.", true);
    return;
  }

  saveReminderButton.disabled = true;
  try {
    await saveReminder(currentUser, {
      title: reminderTitle.value.trim(),
      notes: reminderNotes.value.trim(),
      dueAt: dueAt.toISOString(),
      timeZone: reminderTimeZone,
      sourceTranscript: proposedTranscript
    });
    proposalSection.hidden = true;
    setReminderMessage("Reminder saved to your Firebase account.");
  } catch (error) {
    setReminderMessage(`Could not save reminder: ${error.message}`, true);
  } finally {
    saveReminderButton.disabled = false;
  }
});

cancelProposalButton.addEventListener("click", () => {
  proposalSection.hidden = true;
  setReminderMessage("Reminder proposal canceled.");
});

if (firebaseConfigured) {
  accountControls.hidden = false;
  firebaseStatus.textContent = "Connecting to Firebase...";
  try {
    initializeFirebase(handleAuthState);
  } catch (error) {
    firebaseStatus.textContent = `Firebase could not start: ${error.message}`;
  }
} else {
  firebaseStatus.textContent =
    "Set up your Firebase web app configuration in public/firebase-config.js to enable reminder sign-in and storage.";
}

window.addEventListener("pagehide", () => {
  unsubscribeReminders?.();
  void client.close();
  if (playbackUrl) {
    URL.revokeObjectURL(playbackUrl);
  }
});

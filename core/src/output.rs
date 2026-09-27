use anyhow::{Context, Result};
use arboard::Clipboard;
use std::sync::Mutex;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Delivered {
    Pasted,
    Copied,
}

/// One process-wide clipboard handle. On X11/Wayland the owning process serves clipboard
/// contents, and they vanish when the last `Clipboard` is dropped, so we never drop it.
/// ponytail: never dropped at exit; whatever a clipboard manager didn't grab is lost on quit.
static CLIPBOARD: Mutex<Option<Clipboard>> = Mutex::new(None);

/// Put `text` on the clipboard and, if `auto_paste`, simulate Ctrl+V into the focused app.
/// If key simulation fails (e.g. Wayland) the text stays on the clipboard → `Copied`.
/// With `restore_clipboard`, the previous clipboard text is put back ~200 ms after pasting.
pub fn deliver(text: &str, auto_paste: bool, restore_clipboard: bool) -> Result<Delivered> {
    let mut guard = CLIPBOARD.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        *guard = Some(Clipboard::new().context("clipboard unavailable")?);
    }
    let cb = guard.as_mut().expect("initialized above");
    let previous = cb.get_text().ok();
    cb.set_text(text).context("failed to write clipboard")?;
    if !auto_paste {
        return Ok(Delivered::Copied);
    }
    if let Err(e) = paste() {
        eprintln!("voxflow: paste simulation failed: {e:#}");
        return Ok(Delivered::Copied);
    }
    if let (true, Some(prev)) = (restore_clipboard, previous) {
        std::thread::sleep(Duration::from_millis(200)); // let the target app read the clipboard
        let _ = cb.set_text(prev);
    }
    Ok(Delivered::Pasted)
}

fn paste() -> Result<()> {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};
    let mut enigo = Enigo::new(&Settings::default())?;
    enigo.key(Key::Control, Direction::Press)?;
    let click = enigo.key(Key::Unicode('v'), Direction::Click);
    enigo.key(Key::Control, Direction::Release)?; // always release, even if the click failed
    Ok(click?)
}

use anyhow::{Context, Result};
use arboard::{Clipboard, ImageData};
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
/// With `restore_clipboard`, the previous clipboard text or image is put back ~400 ms after
/// pasting, unless something else was copied in the meantime.
pub fn deliver(text: &str, auto_paste: bool, restore_clipboard: bool) -> Result<Delivered> {
    let text = sanitize(text);
    let mut guard = CLIPBOARD.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        *guard = Some(Clipboard::new().context("clipboard unavailable")?);
    }
    let cb = guard.as_mut().expect("initialized above");
    let previous = if auto_paste && restore_clipboard {
        match cb.get_text() {
            Ok(t) => Some(Previous::Text(t)),
            Err(_) => cb.get_image().ok().map(Previous::Image),
        }
    } else {
        None
    };
    cb.set_text(&text).context("failed to write clipboard")?;
    if !auto_paste {
        return Ok(Delivered::Copied);
    }
    if let Err(e) = paste() {
        eprintln!("voxflow: paste simulation failed: {e:#}");
        return Ok(Delivered::Copied);
    }
    if let Some(prev) = previous {
        std::thread::sleep(Duration::from_millis(400)); // let the target app read the clipboard
        if cb.get_text().is_ok_and(|t| t == text) {
            let _ = match prev {
                Previous::Text(t) => cb.set_text(t),
                Previous::Image(i) => cb.set_image(i),
            };
        }
    }
    Ok(Delivered::Pasted)
}

enum Previous {
    Text(String),
    Image(ImageData<'static>),
}

/// Transcripts are pasted into arbitrary apps (terminals included): control chars such as
/// a newline would act as Enter. Replace them with spaces, collapse whitespace, trim.
pub fn sanitize(text: &str) -> String {
    text.split(|c: char| c.is_control() || c.is_whitespace())
        .filter(|w| !w.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn paste() -> Result<()> {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};
    let mut enigo = Enigo::new(&Settings::default())?;
    enigo.key(Key::Control, Direction::Press)?;
    let click = enigo.key(Key::Unicode('v'), Direction::Click);
    enigo.key(Key::Control, Direction::Release)?; // always release, even if the click failed
    Ok(click?)
}

#[cfg(test)]
mod tests {
    #[test]
    fn sanitize_strips_controls_and_collapses_whitespace() {
        assert_eq!(super::sanitize("  hi\r\nthere\t you\u{1b}[31m \u{7f}x \u{0}"), "hi there you [31m x");
        assert_eq!(super::sanitize("rm -rf /\n"), "rm -rf /");
        assert_eq!(super::sanitize("\n\t "), "");
        assert_eq!(super::sanitize("héllo  wörld"), "héllo wörld");
    }
}

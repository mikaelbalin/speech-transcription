use std::fs::{File, OpenOptions};
use std::os::fd::AsRawFd;
use std::sync::OnceLock;
use std::time::Duration;

/// Sends Ctrl+V using a uinput virtual keyboard (works on Wayland).
///
/// We build the device with raw `libc` ioctls (rather than the `evdev` crate)
/// because libinput/KWin only treat a device as a real keyboard when udev's
/// `input_id` sets `ID_INPUT_KEYBOARD=1`, which requires the full
/// `KEY_ESC..KEY_D` range (keycodes 1..=31), plus `EV_REP` and `EV_LED`. The
/// `evdev` crate does not expose those bits.
///
/// Requires write access to `/dev/uinput` (root, or `input` group via a udev
/// rule — configured by the installer, not during development).
pub fn send_paste() -> Result<(), String> {
    let file = device_file()?;
    let fd = file.as_raw_fd();

    // Ctrl down.
    write_event(fd, EV_KEY as u16, KEY_LEFTCTRL as u16, 1)?;
    // V down.
    write_event(fd, EV_KEY as u16, KEY_V as u16, 1)?;
    // V up.
    write_event(fd, EV_KEY as u16, KEY_V as u16, 0)?;
    // Ctrl up.
    write_event(fd, EV_KEY as u16, KEY_LEFTCTRL as u16, 0)?;

    Ok(())
}

/// Returns the lazily-created, reused uinput keyboard file. The `File` is kept
/// alive for the process lifetime (holding the underlying fd open).
///
/// The device is created once and kept alive for the process lifetime. Creating
/// it on every paste was prohibitively slow: KWin/libinput attach to a new
/// uinput device asynchronously, so each creation required a ~1s sleep before
/// keystrokes would be accepted.
fn device_file() -> Result<&'static File, String> {
    static FILE: OnceLock<Result<File, String>> = OnceLock::new();
    match FILE.get_or_init(create_device) {
        Ok(file) => Ok(file),
        Err(e) => Err(e.clone()),
    }
}

/// Creates the uinput keyboard and waits for the compositor to attach to it.
fn create_device() -> Result<File, String> {
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .open("/dev/uinput")
        .map_err(|e| format!("open /dev/uinput: {e}"))?;
    let fd = file.as_raw_fd();

    // Event types: key, misc (scan codes), repeat, LEDs.
    for ev in [EV_KEY, EV_MSC, EV_REP, EV_LED] {
        set_bit(fd, UI_SET_EVBIT, ev)?;
    }

    // Keys we actually emit.
    for key in [KEY_LEFTCTRL, KEY_V] {
        set_bit(fd, UI_SET_KEYBIT, key)?;
    }

    // Full KEY_ESC..KEY_D range — required for ID_INPUT_KEYBOARD=1.
    for key in 1..=31u32 {
        set_bit(fd, UI_SET_KEYBIT, key)?;
    }

    // MSC_SCAN capability (real keyboards report scan codes).
    set_bit(fd, UI_SET_MSCBIT, MSC_SCAN)?;

    // LED capability (CapsLock/NumLock/ScrollLock).
    for led in [LED_NUML, LED_CAPSL, LED_SCROLLL] {
        set_bit(fd, UI_SET_LEDBIT, led)?;
    }

    // Device identity.
    let mut setup = UinputSetup {
        bustype: 0x0003, // BUS_USB
        vendor: 0x1234,
        product: 0x5678,
        version: 1,
        name: [0u8; 80],
        ff_effects_max: 0,
    };
    let name = b"speech-transcription";
    setup.name[..name.len()].copy_from_slice(name);
    let rc = unsafe { libc::ioctl(fd, UI_DEV_SETUP, &setup) };
    if rc < 0 {
        return Err(format!("UI_DEV_SETUP: {}", std::io::Error::last_os_error()));
    }

    let rc = unsafe { libc::ioctl(fd, UI_DEV_CREATE) };
    if rc < 0 {
        return Err(format!(
            "UI_DEV_CREATE: {}",
            std::io::Error::last_os_error()
        ));
    }

    // KWin/libinput does not open the device synchronously — give the
    // compositor a moment to attach before emitting events, otherwise the
    // keystrokes are dropped. This one-time cost is paid only at device
    // creation, not on every paste.
    std::thread::sleep(Duration::from_millis(1000));

    Ok(file)
}

/// Writes a single input event followed by a SYN_REPORT.
fn write_event(fd: i32, ev_type: u16, code: u16, value: i32) -> Result<(), String> {
    let ev = InputEvent {
        tv_sec: 0,
        tv_usec: 0,
        ev_type,
        code,
        value,
    };

    write_raw(fd, &ev)?;

    // SYN_REPORT
    let syn = InputEvent {
        tv_sec: 0,
        tv_usec: 0,
        ev_type: EV_SYN,
        code: SYN_REPORT,
        value: 0,
    };
    write_raw(fd, &syn)?;

    Ok(())
}

fn write_raw(fd: i32, ev: &InputEvent) -> Result<(), String> {
    let bytes = unsafe {
        std::slice::from_raw_parts(
            (ev as *const InputEvent) as *const u8,
            std::mem::size_of::<InputEvent>(),
        )
    };
    let rc = unsafe { libc::write(fd, bytes.as_ptr() as *const libc::c_void, bytes.len()) };
    if rc < 0 {
        return Err(format!(
            "write input event: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

fn set_bit(fd: i32, ioctl_num: u64, bit: u32) -> Result<(), String> {
    let rc = unsafe { libc::ioctl(fd, ioctl_num, bit) };
    if rc < 0 {
        return Err(format!(
            "ioctl {ioctl_num:#x} bit {bit}: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

// --- ioctl encoding (Linux asm-generic `_IOC`) ---
const IOC_WRITE: u32 = 1;

const fn _io(nr: u32) -> u64 {
    ((b'U' as u64) << 8) | nr as u64
}

const fn _iow(nr: u32, size: u64) -> u64 {
    ((IOC_WRITE as u64) << 30) | (size << 16) | ((b'U' as u64) << 8) | nr as u64
}

const UI_DEV_CREATE: u64 = _io(1);
const UI_DEV_SETUP: u64 = _iow(3, 92);
const UI_SET_EVBIT: u64 = _iow(100, 4);
const UI_SET_KEYBIT: u64 = _iow(101, 4);
const UI_SET_MSCBIT: u64 = _iow(104, 4);
const UI_SET_LEDBIT: u64 = _iow(105, 4);

// struct uinput_setup { struct input_id id; char name[80]; __u32 ff_effects_max; }
#[repr(C)]
struct UinputSetup {
    bustype: u16,
    vendor: u16,
    product: u16,
    version: u16,
    name: [u8; 80],
    ff_effects_max: u32,
}

// --- Linux input event constants ---
// struct input_event { struct timeval time; __u16 type; __u16 code; __s32 value; }
#[repr(C)]
struct InputEvent {
    tv_sec: libc::time_t,
    tv_usec: libc::suseconds_t,
    ev_type: u16,
    code: u16,
    value: i32,
}

const EV_SYN: u16 = 0x00;
const EV_KEY: u32 = 0x01;
const EV_MSC: u32 = 0x04;
const EV_LED: u32 = 0x11;
const EV_REP: u32 = 0x14;
const SYN_REPORT: u16 = 0x00;
const KEY_LEFTCTRL: u32 = 29;
const KEY_V: u32 = 47;
const MSC_SCAN: u32 = 0x04;
const LED_NUML: u32 = 0x00;
const LED_CAPSL: u32 = 0x01;
const LED_SCROLLL: u32 = 0x02;

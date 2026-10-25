//! C interface for the macOS shell (include/tradclip.h).

use std::ffi::{c_char, CStr, CString};

/// Loads the dictionaries ahead of the first conversion.
#[no_mangle]
pub extern "C" fn tradclip_warm_up() {
    crate::warm_up();
}

/// Converts a NUL-terminated UTF-8 string. Returns a new string to release with
/// `tradclip_free`, or NULL when the input is NULL or not UTF-8.
///
/// # Safety
/// `text` must be NULL or point to a NUL-terminated string.
#[no_mangle]
pub unsafe extern "C" fn tradclip_convert(text: *const c_char) -> *mut c_char {
    if text.is_null() {
        return std::ptr::null_mut();
    }
    let Ok(input) = CStr::from_ptr(text).to_str() else {
        return std::ptr::null_mut();
    };
    CString::new(crate::convert(input)).map_or(std::ptr::null_mut(), CString::into_raw)
}

/// Releases a string returned by `tradclip_convert`.
///
/// # Safety
/// `text` must be NULL or a pointer returned by `tradclip_convert`, released once.
#[no_mangle]
pub unsafe extern "C" fn tradclip_free(text: *mut c_char) {
    if !text.is_null() {
        drop(CString::from_raw(text));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_through_c_strings() {
        let input = CString::new("我们").unwrap();
        unsafe {
            let out = tradclip_convert(input.as_ptr());
            assert_eq!(CStr::from_ptr(out).to_str().unwrap(), "我們");
            tradclip_free(out);
            assert!(tradclip_convert(std::ptr::null()).is_null());
        }
    }
}

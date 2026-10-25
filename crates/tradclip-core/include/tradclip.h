#ifndef TRADCLIP_H
#define TRADCLIP_H

/* Loads the dictionaries ahead of the first conversion. */
void tradclip_warm_up(void);

/* Converts NUL-terminated UTF-8 Simplified Chinese to Traditional (Taiwan forms).
   Returns a new string to release with tradclip_free, or NULL on NULL or bad UTF-8. */
char *tradclip_convert(const char *text);

void tradclip_free(char *text);

#endif

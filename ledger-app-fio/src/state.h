#ifndef H_FIO_APP_STATE
#define H_FIO_APP_STATE

#include "getVersion.h"
#include "getPublicKeys.h"

typedef struct {
	int placeholder;
	int placeholder2;
} placeholder_t;




typedef union {
	// Here should go states of all instructions
	ins_get_keys_context_t getKeysContext;
	placeholder_t placeholder;
} instructionState_t;

// Note(instructions are uint8_t but we have a special INS_NONE value
extern int currentInstruction;

extern instructionState_t instructionState;

#endif // H_FIO_APP_STATE
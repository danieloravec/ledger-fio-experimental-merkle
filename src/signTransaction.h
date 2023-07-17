#ifndef H_FIO_APP_SIGN_TRANSACTION
#define H_FIO_APP_SIGN_TRANSACTION

#include "diffieHellman.h"
#include "handlers.h"
#include "hash.h"
#include "fio.h"
#include "keyDerivation.h"
#include "signTransactionIntegrity.h"
#include "signTransactionCountedSection.h"
#include <stdint.h>

handler_fn_t signTransaction_handleAPDU;

#define MAX_DISPLAY_KEY_LENGTH   20
#define MAX_DISPLAY_VALUE_LENGTH 220

#define MAX_TX_APPEND_IN_SINGLE_APDU 220

typedef struct {
    uint32_t initialized_magic;

    uint8_t storedValueLen1;
    uint8_t storedValue1[8];

    uint8_t storedValueLen2;
    uint8_t storedValue2[8];

    uint8_t storedValueLen3;
    uint8_t storedValue3[64];
} tx_value_storage_t;

typedef struct {
    uint16_t initWasCalledMagic;
    bip44_path_t wittnessPath;
    sha_256_context_t hashContext;
    tx_integrity_t integrity;
    tx_counted_section_t countedSections;
    tx_value_storage_t storage;

    // This is data before posible DH encoding
    uint8_t dataToAppendToTxLen;
    uint8_t dataToAppendToTx[MAX_TX_APPEND_IN_SINGLE_APDU];

    int ui_step;
    uint8_t responseLength;  // Response is in G_io_apdu_buffer

    // Null terminated strings to display
    char key[MAX_DISPLAY_KEY_LENGTH];
    char value[MAX_DISPLAY_VALUE_LENGTH];
} ins_sign_transaction_context_t;

#endif  // H_FIO_APP_SIGN_TRANSACTION

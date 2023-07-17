#include "common.h"
#include "handlers.h"
#include "eos_utils.h"
#include "getSerial.h"
#include "state.h"
#include "fio.h"
#include "hash.h"
#include "lcx_rng.h"
#include "securityPolicy.h"
#include "signTransactionCountedSection.h"
#include "signTransactionIntegrity.h"
#include "signTransactionParse.h"
#include "uiHelpers.h"
#include "uiScreens.h"
#include "textUtils.h"

static ins_sign_transaction_context_t* ctx = &(instructionState.signTransactionContext);

// ============================== MISC ==============================

typedef enum {
    VALUE_STORAGE_CHECK_NO = 0x00,
    VALUE_STORAGE_CHECK_R1 = 0x10,
    VALUE_STORAGE_CHECK_R2 = 0x20,
    VALUE_STORAGE_CHECK_R3 = 0x30,
    VALUE_STORAGE_CHECK_R1_DECODE_NAME = 0x40,
} tx_storage_check_t;

enum {
    TX_STORAGE_INITIALIZED_MAGIC = 12345,
};

enum {
    TX_INIT_WAS_CALLED_INITIALIZED_MAGIC = 12346,
};

// Taken from EOS app. Needed to produce signatures.
static uint8_t const SECP256K1_N[] = {
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe,
    0xba, 0xae, 0xdc, 0xe6, 0xaf, 0x48, 0xa0, 0x3b, 0xbf, 0xd2, 0x5e, 0x8c, 0xd0, 0x36, 0x41, 0x41};

// Uses ctx->dataToAppendToTx, ctx->dataToAppendToTxLen to extend hash
static void processShaAndPrepareResponse() {
    sha_256_append(&ctx->hashContext, ctx->dataToAppendToTx, ctx->dataToAppendToTxLen);
    ctx->responseLength = 0;
}

// Takes &ctx->wittnessPath and modifies ctx->value to be null terminated scting to display the
// pubkey
static void prepareOurPubkeyForDisplay() {
    public_key_t wittnessPathPubkey;
    explicit_bzero(&wittnessPathPubkey, SIZEOF(wittnessPathPubkey));
    derivePublicKey(&ctx->wittnessPath, &wittnessPathPubkey);
    TRACE_BUFFER(wittnessPathPubkey.W, SIZEOF(wittnessPathPubkey.W));

    uint32_t outlen = public_key_to_wif(wittnessPathPubkey.W,
                                        SIZEOF(wittnessPathPubkey.W),
                                        ctx->value,
                                        SIZEOF(ctx->value));
    ASSERT(outlen < SIZEOF(ctx->value));
    ctx->value[outlen] = 0;
}

// Simple reusable UI step with one or no screens
enum {
    HANDLE_SIMPLE_STEP_DISPLAY_DETAILS = 100,
    HANDLE_SIMPLE_STEP_RESPOND,
    HANDLE_SIMPLE_STEP_INVALID,
};

static void signTx_ui_runStep_simple() {
    TRACE("UI step %d", ctx->ui_step);
    TRACE_STACK_USAGE();
    ui_callback_fn_t* this_fn = signTx_ui_runStep_simple;

    UI_STEP_BEGIN(ctx->ui_step, this_fn);

    UI_STEP(HANDLE_SIMPLE_STEP_DISPLAY_DETAILS) {
        ui_displayPaginatedText(ctx->key, ctx->value, this_fn);
    }

    UI_STEP(HANDLE_SIMPLE_STEP_RESPOND) {
        TRACE();
        io_send_buf(SUCCESS, G_io_apdu_buffer, ctx->responseLength);
        ui_displayBusy();  // needs to happen after I/O
    }

    UI_STEP_END(HANDLE_SIMPLE_STEP_INVALID);
}

// ============================== INIT ==============================

__noinline_due_to_stack__ void signTx_handleInitAPDU(uint8_t p2,
                                                     MARK_UNUSED_NO_DEVEL uint8_t* constDataBuffer,
                                                     size_t constSize,
                                                     uint8_t* varDataBuffer,
                                                     size_t varSize) {
    // Sanity checks and trace buffers
    TRACE_STACK_USAGE();
    {
        VALIDATE(p2 == P2_UNUSED, ERR_INVALID_REQUEST_PARAMETERS);
        TRACE_BUFFER(constDataBuffer, constSize);
        TRACE_BUFFER(varDataBuffer, varSize);
    }

    // Data format
    VALIDATE(constSize == 0, ERR_INVALID_DATA);
    struct {
        uint8_t chainId[CHAIN_ID_LENGTH];
        uint8_t derivationPath[1 + sizeof(uint32_t) *
                                       BIP44_MAX_PATH_ELEMENTS];  // 1 stands for number of
                                                                  // derivation math elements
    }* varData = (void*) varDataBuffer;
    VALIDATE(varSize >= SIZEOF(varData->chainId), ERR_INVALID_DATA);

    // Parsing: network, ctx->wittnessPath, ctx->dataToAppendToTx,
    network_type_t network = NETWORK_UNKNOWN;
    {
        network = getNetworkByChainId(varData->chainId, SIZEOF(varData->chainId));
        TRACE("Chain: %d", (int) network);
        VALIDATE(network == NETWORK_MAINNET || network == NETWORK_TESTNET, ERR_INVALID_DATA);

        const size_t parsedSize = bip44_parseFromWire(&ctx->wittnessPath,
                                                      varData->derivationPath,
                                                      varSize - SIZEOF(varData->chainId));
        BIP44_PRINTF(&ctx->wittnessPath);
        PRINTF("\n");
        VALIDATE(parsedSize == varSize - SIZEOF(varData->chainId), ERR_INVALID_DATA);

        STATIC_ASSERT(SIZEOF(ctx->dataToAppendToTx) >= SIZEOF(varData->chainId),
                      "Buffer too small");
        memcpy(ctx->dataToAppendToTx, varData->chainId, SIZEOF(varData->chainId));
        ctx->dataToAppendToTxLen = SIZEOF(varData->chainId);
    }

    // Prepare display variables ctx->key, ctx->value
    {
        TRACE_STACK_USAGE();
        snprintf(ctx->key, MAX_DISPLAY_KEY_LENGTH, "Chain");
        switch (network) {
#define CASE(NETWORK, CHAIN_STRING)                                 \
    case NETWORK: {                                                 \
        snprintf(ctx->value, MAX_DISPLAY_KEY_LENGTH, CHAIN_STRING); \
        break;                                                      \
    }
            CASE(NETWORK_MAINNET, "Mainnet");
            CASE(NETWORK_TESTNET, "Testnet");
            default:
                THROW(ERR_NOT_IMPLEMENTED);
#undef CASE
        }
    }
    // Reading data finished, from now on we use G_io_apdu_buffer for output

    // Append data to hash and prepare response (none)
    {
        TRACE_STACK_USAGE();
        VALIDATE(countedSectionProcess(&ctx->countedSections, ctx->dataToAppendToTxLen),
                 ERR_INVALID_DATA);
        sha_256_append(&ctx->hashContext, ctx->dataToAppendToTx, ctx->dataToAppendToTxLen);

        ctx->responseLength = 0;
    }

    // Security policy
    security_policy_t policy = POLICY_DENY;
    {
        policy = policyForSignTxInit(&ctx->wittnessPath);
        TRACE("Policy: %d", (int) policy);
        ENSURE_NOT_DENIED(policy);
        {
            // select UI steps
            switch (policy) {
#define CASE(POLICY, UI_STEP)   \
    case POLICY: {              \
        ctx->ui_step = UI_STEP; \
        break;                  \
    }
                CASE(POLICY_SHOW_BEFORE_RESPONSE, HANDLE_SIMPLE_STEP_DISPLAY_DETAILS);
                default:
                    THROW(ERR_NOT_IMPLEMENTED);
#undef CASE
            }
        }
    }

    // Run ui step
    signTx_ui_runStep_simple();
}

// ======================= APPEND CONST DATA ===========================

__noinline_due_to_stack__ void signTx_handleAppendConstDataAPDU(
    uint8_t p2,
    uint8_t* constDataBuffer,
    size_t constSize,
    MARK_UNUSED_NO_DEVEL uint8_t* varDataBuffer,
    size_t varSize) {
    // Sanity checks and trace buffers
    TRACE_STACK_USAGE();
    {
        VALIDATE(p2 == P2_UNUSED, ERR_INVALID_REQUEST_PARAMETERS);
        TRACE_BUFFER(constDataBuffer, constSize);
        TRACE_BUFFER(varDataBuffer, varSize);
    }

    // Data format
    struct {
        uint8_t data[MAX_TX_APPEND_IN_SINGLE_APDU];
    }* constData = (void*) constDataBuffer;
    VALIDATE(constSize < MAX_TX_APPEND_IN_SINGLE_APDU, ERR_INVALID_DATA);
    VALIDATE(varSize == 0, ERR_INVALID_DATA);

    // Parsing: ctx->dataToAppendToTx, ctx->dataToAppendToTxLen
    // Preparing display variables ctx->key, ctx->value
    {
        memcpy(ctx->dataToAppendToTx, constData, constSize);
        ctx->dataToAppendToTxLen = constSize;
        ctx->key[0] = 0;
        ctx->value[0] = 0;
    }
    // Reading data finished, from now on we use G_io_apdu_buffer for output

    // Append data to hash and prepare response
    {
        VALIDATE(countedSectionProcess(&ctx->countedSections, ctx->dataToAppendToTxLen),
                 ERR_INVALID_DATA);
        processShaAndPrepareResponse();
    }

    // Run ui step
    ctx->ui_step = HANDLE_SIMPLE_STEP_RESPOND;
    signTx_ui_runStep_simple();
}

// ======================= SHOW MESSAGE ===========================

__noinline_due_to_stack__ void signTx_handleShowMessageAPDU(
    uint8_t p2,
    uint8_t* constDataBuffer,
    size_t constSize,
    MARK_UNUSED_NO_DEVEL uint8_t* varDataBuffer,
    size_t varSize) {
    // Sanity checks and trace buffers
    TRACE_STACK_USAGE();
    {
        VALIDATE(p2 == P2_UNUSED, ERR_INVALID_REQUEST_PARAMETERS);
        TRACE_BUFFER(constDataBuffer, constSize);
        TRACE_BUFFER(varDataBuffer, varSize);
    }

    // Data format
    struct {
        uint8_t displayKeyLen;
        uint8_t displayKey[MAX_DISPLAY_KEY_LENGTH];
    }* constData = (void*) constDataBuffer;
    VALIDATE(constSize >= 1, ERR_INVALID_DATA);
    VALIDATE(constData->displayKeyLen < MAX_DISPLAY_KEY_LENGTH - 1, ERR_INVALID_DATA);
    VALIDATE(constSize >= 2 + constData->displayKeyLen, ERR_INVALID_DATA);
    struct {
        uint8_t displayValueLen;
        uint8_t displayValue[MAX_DISPLAY_VALUE_LENGTH];
    }* constData2 = (void*) constDataBuffer + 1 + constData->displayKeyLen;
    VALIDATE(constData2->displayValueLen < MAX_DISPLAY_VALUE_LENGTH - 1, ERR_INVALID_DATA);
    VALIDATE(constSize == 2 + constData->displayKeyLen + constData2->displayValueLen,
             ERR_INVALID_DATA);
    VALIDATE(varSize == 0, ERR_INVALID_DATA);

    // Parsing
    // Prepare display variables ctx->key, ctx->value
    {
        STATIC_ASSERT(SIZEOF(ctx->key) >= SIZEOF(constData->displayKey),
                      "Display buffer too small");
        STATIC_ASSERT(SIZEOF(ctx->value) >= SIZEOF(constData2->displayValue),
                      "Display buffer too small");
        str_validateTextBuffer(constData->displayKey, constData->displayKeyLen);
        str_validateTextBuffer(constData2->displayValue, constData2->displayValueLen);
        memmove(ctx->key, constData->displayKey, constData->displayKeyLen);
        ctx->key[constData->displayKeyLen] = 0;
        memmove(ctx->value, constData2->displayValue, constData2->displayValueLen);
        ctx->value[constData2->displayValueLen] = 0;
    }

    // Reading data finished, from now on we use G_io_apdu_buffer for output

    // Append data to hash (none) and prepare response (none)
    { ctx->responseLength = 0; }

    // Run ui step
    ctx->ui_step = HANDLE_SIMPLE_STEP_DISPLAY_DETAILS;
    signTx_ui_runStep_simple();
}

// ======================= APPEND DATA ===========================

__noinline_due_to_stack__ void signTx_handleAppendDataAPDU(uint8_t p2,
                                                           uint8_t* constDataBuffer,
                                                           size_t constSize,
                                                           uint8_t* varDataBuffer,
                                                           size_t varSize) {
    // Sanity checks and trace buffers
    TRACE_STACK_USAGE();
    {
        VALIDATE(p2 == P2_UNUSED, ERR_INVALID_REQUEST_PARAMETERS);
        TRACE_BUFFER(constDataBuffer, constSize);
        TRACE_BUFFER(varDataBuffer, varSize);
    }

    // Data format
    struct {
        uint8_t valueFormat;
        uint8_t valueValidation;
        uint8_t valueValidationArg1[8];
        uint8_t valueValidationArg2[8];
        uint8_t valuePolicyAndStorage;
        uint8_t displayKeyLen;
        uint8_t displayKey[MAX_DISPLAY_KEY_LENGTH];
    }* constData = (void*) constDataBuffer;
    VALIDATE(constSize >= 20, ERR_INVALID_DATA);
    VALIDATE(constData->displayKeyLen <= MAX_DISPLAY_KEY_LENGTH - 1, ERR_INVALID_DATA);
    VALIDATE(constSize == 20 + constData->displayKeyLen, ERR_INVALID_DATA);
    struct {
        uint8_t value[MAX_TX_APPEND_IN_SINGLE_APDU];
    }* varData = (void*) varDataBuffer;
    VALIDATE(varSize <= MAX_TX_APPEND_IN_SINGLE_APDU, ERR_INVALID_DATA);

    // Storage validation
    {
        tx_storage_check_t storage = constData->valuePolicyAndStorage & 0xF0;
        TRACE("Storage request :%d, Stored length %d,%d,%d",
              (int) storage / 0x10,
              (int) ctx->storage.storedValueLen1,
              (int) ctx->storage.storedValueLen2,
              (int) ctx->storage.storedValueLen3);
        TRACE("Initialized: %d", ctx->storage.initialized_magic);
        switch (storage) {
#define CASE_STORAGE_EQUALS(n)                                                                     \
    case VALUE_STORAGE_CHECK_R##n: {                                                               \
        ASSERT(ctx->storage.initialized_magic == TX_STORAGE_INITIALIZED_MAGIC);                    \
        ASSERT(ctx->storage.storedValueLen##n <= sizeof(ctx->storage.storedValue##n));             \
        VALIDATE(ctx->storage.storedValueLen##n == varSize, ERR_INVALID_DATA);                     \
        VALIDATE(!memcmp(ctx->storage.storedValue##n, varData->value, varSize), ERR_INVALID_DATA); \
        break;                                                                                     \
    }
            CASE_STORAGE_EQUALS(1);
            CASE_STORAGE_EQUALS(2);
            CASE_STORAGE_EQUALS(3);
            case VALUE_STORAGE_CHECK_R1_DECODE_NAME: {
                ASSERT(ctx->storage.initialized_magic == TX_STORAGE_INITIALIZED_MAGIC);
                ASSERT(ctx->storage.storedValueLen1 <= sizeof(ctx->storage.storedValue1));
                char buffer[14];
                uint8array_name_to_string(ctx->storage.storedValue1,
                                          ctx->storage.storedValueLen1,
                                          buffer,
                                          SIZEOF(buffer));
                VALIDATE(varSize < SIZEOF(buffer), ERR_INVALID_DATA);
                TRACE("%s", buffer);
                TRACE("%s", varData->value);
                TRACE("%d", varSize);
                VALIDATE(buffer[varSize] == 0, ERR_INVALID_DATA);
                VALIDATE(!memcmp(buffer, varData->value, varSize), ERR_INVALID_DATA);
                break;
            }
            case VALUE_STORAGE_CHECK_NO:
                break;
            default:
                THROW(ERR_INVALID_DATA);
#undef CASE_STORAGE_EQUALS
        }
    }

    // Parsing ctx->dataToAppendToTx, ctx->dataToAppendToTxLen
    // Prepare display variables ctx->key, ctx->value, policy
    security_policy_t policy = POLICY_DENY;
    {
        str_validateTextBuffer(constData->displayKey, constData->displayKeyLen);
        ASSERT(SIZEOF(ctx->key) >= constData->displayKeyLen + 1);
        memcpy(ctx->key, constData->displayKey, constData->displayKeyLen);
        ctx->key[constData->displayKeyLen] = 0;

        parseValueToDisplay(constData->valueFormat,
                            constData->valueValidation,
                            constData->valueValidationArg1,
                            constData->valueValidationArg2,
                            varData->value,
                            varSize,
                            ctx->value);

        ASSERT(SIZEOF(ctx->dataToAppendToTx) >= varSize);
        memcpy(ctx->dataToAppendToTx, varData->value, varSize);
        ctx->dataToAppendToTxLen = varSize;

        policy = constData->valuePolicyAndStorage & 0x0F;
    }

    // Reading data finished, from now on we use G_io_apdu_buffer for output

    // Append data to hash and prepare response
    {
        VALIDATE(countedSectionProcess(&ctx->countedSections, varSize), ERR_INVALID_DATA);
        processShaAndPrepareResponse();
    }

    // Policy
    {
        TRACE("Policy %d", (int) policy);
        switch (policy) {
#define CASE(POLICY, UI_STEP)   \
    case POLICY: {              \
        ctx->ui_step = UI_STEP; \
        break;                  \
    }
            CASE(POLICY_ALLOW_WITHOUT_PROMPT, HANDLE_SIMPLE_STEP_RESPOND);
            CASE(POLICY_SHOW_BEFORE_RESPONSE, HANDLE_SIMPLE_STEP_DISPLAY_DETAILS);
            CASE(POLICY_SHOW_BEFORE_RESPONSE_IF_NONEMPTY,
                 strnlen(ctx->value, SIZEOF(ctx->value)) == 0 ? HANDLE_SIMPLE_STEP_RESPOND
                                                              : HANDLE_SIMPLE_STEP_DISPLAY_DETAILS)
            default:
                THROW(ERR_NOT_IMPLEMENTED);
#undef CASE
        }
    }

    // Run ui step
    signTx_ui_runStep_simple();
}

// ======================= START COUNTED SECTION ===========================

__noinline_due_to_stack__ void signTx_handleStartCountedSectionAPDU(uint8_t p2,
                                                                    uint8_t* constDataBuffer,
                                                                    size_t constSize,
                                                                    uint8_t* varDataBuffer,
                                                                    size_t varSize) {
    // Sanity checks and trace buffers
    TRACE_STACK_USAGE();
    {
        VALIDATE(p2 == P2_UNUSED, ERR_INVALID_REQUEST_PARAMETERS);
        TRACE_BUFFER(constDataBuffer, constSize);
        TRACE_BUFFER(varDataBuffer, varSize);
    }

    // Data format
    struct {
        uint8_t valueFormat;
        uint8_t valueValidation;
        uint8_t valueValidationArg1[8];
        uint8_t valueValidationArg2[8];
    }* constData = (void*) constDataBuffer;
    VALIDATE(constSize == SIZEOF(*constData), ERR_INVALID_DATA);
    struct {
        uint8_t value[MAX_TX_APPEND_IN_SINGLE_APDU];
    }* varData = (void*) varDataBuffer;
    VALIDATE(varSize <= MAX_TX_APPEND_IN_SINGLE_APDU, ERR_INVALID_DATA);

    // Parse data numberOfExpectedBytes, ctx->dataToAppendToTx, ctx->dataToAppendToTxLen
    uint32_t numberOfExpectedBytes = 0;
    {
        uint64_t value = 0;
        parseValueToUInt64(constData->valueFormat,
                           constData->valueValidation,
                           constData->valueValidationArg1,
                           constData->valueValidationArg2,
                           varData->value,
                           varSize,
                           &value);
        VALIDATE(value <= UINT32_MAX, ERR_INVALID_DATA);  // to fit into uint32_t
        numberOfExpectedBytes = value;

        memcpy(ctx->dataToAppendToTx, varData->value, varSize);
        ctx->dataToAppendToTxLen = varSize;
    }

    // Preparing display variables ctx->key, ctx->value
    {
        ctx->key[0] = 0;
        ctx->value[0] = 0;
    }

    // Reading data finished, from now on we use G_io_apdu_buffer for output

    // Append data to hash and prepare response, begin counted section
    {
        // this data does not count towards new counted section but counts towards old ones
        VALIDATE(countedSectionProcess(&ctx->countedSections, ctx->dataToAppendToTxLen),
                 ERR_INVALID_DATA);
        VALIDATE(countedSectionBegin(&ctx->countedSections, numberOfExpectedBytes),
                 ERR_INVALID_DATA);
        processShaAndPrepareResponse();
    }

    // Run ui step
    ctx->ui_step = HANDLE_SIMPLE_STEP_RESPOND;
    signTx_ui_runStep_simple();
}

// ======================= END COUNTED SECTION ===========================

__noinline_due_to_stack__ void signTx_handleEndCountedSectionAPDU(
    uint8_t p2,
    MARK_UNUSED_NO_DEVEL uint8_t* constDataBuffer,
    size_t constSize,
    MARK_UNUSED_NO_DEVEL uint8_t* varDataBuffer,
    size_t varSize) {
    // Sanity checks and trace buffers
    TRACE_STACK_USAGE();
    {
        VALIDATE(p2 == P2_UNUSED, ERR_INVALID_REQUEST_PARAMETERS);
        TRACE_BUFFER(constDataBuffer, constSize);
        TRACE_BUFFER(varDataBuffer, varSize);
    }

    // Data format
    VALIDATE(constSize == 0, ERR_INVALID_DATA);
    VALIDATE(varSize == 0, ERR_INVALID_DATA);

    // Preparing display variables ctx->key, ctx->value
    {
        ctx->key[0] = 0;
        ctx->value[0] = 0;
    }

    // Reading data finished, from now on we use G_io_apdu_buffer for output

    // Apend data to hash (no data) and response (none)
    {
        VALIDATE(countedSectionEnd(&ctx->countedSections), ERR_INVALID_DATA);
        ctx->responseLength = 0;
    }

    // Run ui step
    ctx->ui_step = HANDLE_SIMPLE_STEP_RESPOND;
    signTx_ui_runStep_simple();
}

// ======================= STORE_VALUE ===========================

__noinline_due_to_stack__ void signTx_handleStoreValueAPDU(
    uint8_t p2,
    MARK_UNUSED_NO_DEVEL uint8_t* constDataBuffer,
    size_t constSize,
    uint8_t* varDataBuffer,
    size_t varSize) {
    // Sanity checks and trace buffers
    TRACE_STACK_USAGE();
    {
        VALIDATE(1 <= p2 && p2 <= 3, ERR_INVALID_REQUEST_PARAMETERS);  // we have 3 registers
        TRACE("Storing to %d", (int) p2);
        TRACE_BUFFER(constDataBuffer, constSize);
        TRACE_BUFFER(varDataBuffer, varSize);
    }

    // Data format
    VALIDATE(constSize == 0, ERR_INVALID_DATA);
    struct {
        uint8_t value[MAX_TX_APPEND_IN_SINGLE_APDU];
    }* varData = (void*) varDataBuffer;
    // varSize validated in Storage section

    // Storage
    {
        switch (p2) {
#define CASE(n)                                                                     \
    case n: {                                                                       \
        ASSERT(ctx->storage.initialized_magic == TX_STORAGE_INITIALIZED_MAGIC);     \
        VALIDATE(varSize <= sizeof(ctx->storage.storedValue##n), ERR_INVALID_DATA); \
        ctx->storage.storedValueLen##n = varSize;                                   \
        memcpy(ctx->storage.storedValue##n, varData->value, varSize);               \
        break;                                                                      \
    }
            CASE(1);
            CASE(2);
            CASE(3);
            default:
                THROW(ERR_NOT_IMPLEMENTED);
#undef CASE
        }
    }

    // Preparing display variables ctx->key, ctx->value
    {
        ctx->key[0] = 0;
        ctx->value[0] = 0;
    }

    // Reading data finished, from now on we use G_io_apdu_buffer for output

    // Apend data to hash (no data) and response (no data)
    { ctx->responseLength = 0; }

    // Run ui step
    ctx->ui_step = HANDLE_SIMPLE_STEP_RESPOND;
    signTx_ui_runStep_simple();
}

// ============================== FINISH ==============================

enum {
    HANDLE_FINISH_STEP_DISPLAY_DETAILS = 1000,
    HANDLE_FINISH_STEP_CONFIRM,
    HANDLE_FINISH_STEP_RESPOND,
    HANDLE_FINISH_STEP_INVALID,
};

static void signTx_handleFinish_ui_runStep() {
    TRACE("UI step %d", ctx->ui_step);
    TRACE_STACK_USAGE();
    ui_callback_fn_t* this_fn = signTx_handleFinish_ui_runStep;

    UI_STEP_BEGIN(ctx->ui_step, this_fn);

    UI_STEP(HANDLE_FINISH_STEP_DISPLAY_DETAILS) {
        ui_displayPaginatedText(ctx->key, ctx->value, this_fn);
    }

    UI_STEP(HANDLE_FINISH_STEP_CONFIRM) {
        ui_displayPrompt("Sign", "transaction?", this_fn, respond_with_user_reject);
    }

    UI_STEP(HANDLE_FINISH_STEP_RESPOND) {
        io_send_buf(SUCCESS, G_io_apdu_buffer, PUBKEY_LENGTH + SHA_256_SIZE);
        ui_displayBusy();  // needs to happen after I/O
        ui_idle();         // we are done with this tx
    }

    UI_STEP_END(HANDLE_FINISH_STEP_INVALID);
}

__noinline_due_to_stack__ void signTx_handleFinishAPDU(
    uint8_t p2,
    MARK_UNUSED_NO_DEVEL uint8_t* constDataBuffer,
    size_t constSize,
    MARK_UNUSED_NO_DEVEL uint8_t* varDataBuffer,
    size_t varSize) {
    // Sanity checks and trace buffers
    TRACE_STACK_USAGE();
    {
        VALIDATE(p2 == P2_UNUSED, ERR_INVALID_REQUEST_PARAMETERS);
        TRACE_BUFFER(constDataBuffer, constSize);
        TRACE_BUFFER(varDataBuffer, varSize);
    }

    // Data format
    {
        VALIDATE(constSize == 0, ERR_INVALID_DATA);
        VALIDATE(varSize == 0, ERR_INVALID_DATA);
    }

    // Preparing display variables ctx->key, ctx->value
    {
        snprintf(ctx->key, MAX_DISPLAY_KEY_LENGTH, "Sign with");
        prepareOurPubkeyForDisplay();
    }

    // Reading data finished, from now on we use G_io_apdu_buffer for output

    // Hash - this is the last call, we finalize it + counted sections
    uint8_t hashBuf[SHA_256_SIZE];
    explicit_bzero(hashBuf, SIZEOF(hashBuf));
    {
        sha_256_finalize(&ctx->hashContext, hashBuf, SIZEOF(hashBuf));
        TRACE("SHA_256_finalize, resulting hash:");
        TRACE_BUFFER(hashBuf, SHA_256_SIZE);
    }

    // This is the last call - we need to check integrity of the command sequence + just for good
    // measures we finalize counted section
    {
        VALIDATE(integrityCheckEvaluate(&ctx->integrity), ERR_INTEGRITY_CHECK_FAILED);
        VALIDATE(countedSectionFinalize(&ctx->countedSections), ERR_INVALID_DATA);
    }

    // Security policy
    security_policy_t policy = POLICY_DENY;
    {
        policy = policyForSignTxFinish();
        TRACE("Policy: %d", (int) policy);
        ENSURE_NOT_DENIED(policy);
        {
            // select UI steps
            switch (policy) {
#define CASE(POLICY, UI_STEP)   \
    case POLICY: {              \
        ctx->ui_step = UI_STEP; \
        break;                  \
    }
                CASE(POLICY_PROMPT_BEFORE_RESPONSE, HANDLE_FINISH_STEP_DISPLAY_DETAILS);
                default:
                    THROW(ERR_NOT_IMPLEMENTED);
#undef CASE
            }
        }
    }

    // Derive keys and sign the transaction, setup
    private_key_t privateKey;
    explicit_bzero(&privateKey, SIZEOF(privateKey));
    BEGIN_TRY {
        TRY {
            // We derive the private key
            {
                derivePrivateKey(&ctx->wittnessPath, &privateKey);
                TRACE("privateKey.d:");
                TRACE_BUFFER(privateKey.d, privateKey.d_len);
            }

            // We sign the hash
            // Code producing signatures is taken from EOS app
            uint8_t V[33];
            uint8_t K[32];
            int tries = 0;

            // Loop until a candidate matching the canonical signature is found
            // Taken from EOS app
            // We use G_io_apdu_buffer to save memory (and also to minimize changes to EOS code)
            // The code produces the signature right where we need it for the respons
            explicit_bzero(G_io_apdu_buffer, SIZEOF(G_io_apdu_buffer));
            for (;;) {
                if (tries == 0) {
                    rng_rfc6979(G_io_apdu_buffer + 100,
                                hashBuf,
                                privateKey.d,
                                privateKey.d_len,
                                SECP256K1_N,
                                32,
                                V,
                                K);
                } else {
                    rng_rfc6979(G_io_apdu_buffer + 100, hashBuf, NULL, 0, SECP256K1_N, 32, V, K);
                }
                uint32_t infos;
                cx_ecdsa_sign(&privateKey,
                              CX_NO_CANONICAL | CX_RND_PROVIDED | CX_LAST,
                              CX_SHA256,
                              hashBuf,
                              32,
                              G_io_apdu_buffer + 100,
                              100,
                              &infos);
                TRACE_BUFFER(G_io_apdu_buffer + 100, 100);

                if ((infos & CX_ECCINFO_PARITY_ODD) != 0) {
                    G_io_apdu_buffer[100] |= 0x01;
                }
                G_io_apdu_buffer[0] = 27 + 4 + (G_io_apdu_buffer[100] & 0x01);
                ecdsa_der_to_sig(G_io_apdu_buffer + 100, G_io_apdu_buffer + 1);
                TRACE_BUFFER(G_io_apdu_buffer, PUBKEY_LENGTH);

                if (check_canonical(G_io_apdu_buffer + 1)) {
                    TRACE("Try %d succesfull!", tries);
                    break;
                } else {
                    TRACE("Try %d unsuccesfull!", tries);
                    tries++;
                }
            }
        }
        FINALLY {
            memset(&privateKey, 0, sizeof(privateKey));
        }
    }
    END_TRY;

    // We add hash to the response
    TRACE("ecdsa_der_to_sig_result:");
    TRACE_BUFFER(G_io_apdu_buffer, PUBKEY_LENGTH);
    memcpy(G_io_apdu_buffer + PUBKEY_LENGTH, hashBuf, SHA_256_SIZE);

    signTx_handleFinish_ui_runStep();
}

// ============================== MAIN HANDLER ==============================

typedef void subhandler_fn_t(uint8_t p2,
                             uint8_t* constDataBuffer,
                             size_t constSize,
                             uint8_t* varDataBuffer,
                             size_t varSize);

static subhandler_fn_t* lookup_subhandler(uint8_t p1) {
    switch (p1) {
#define CASE(P1, HANDLER) \
    case P1:              \
        return HANDLER;
#define DEFAULT(HANDLER) \
    default:             \
        return HANDLER;
        CASE(0x01, signTx_handleInitAPDU);
        CASE(0x02, signTx_handleAppendConstDataAPDU);
        CASE(0x03, signTx_handleShowMessageAPDU);
        CASE(0x04, signTx_handleAppendDataAPDU);
        CASE(0x05, signTx_handleStartCountedSectionAPDU);
        CASE(0x06, signTx_handleEndCountedSectionAPDU);
        CASE(0x07, signTx_handleStoreValueAPDU);
        CASE(0x10, signTx_handleFinishAPDU);
        DEFAULT(NULL)
#undef CASE
#undef DEFAULT
    }
}

void signTransaction_handleAPDU(uint8_t p1,
                                uint8_t p2,
                                uint8_t* wireDataBuffer,
                                size_t wireDataSize,
                                bool isNewCall) {
    TRACE("P1 = 0x%x, P2 = 0x%x, isNewCall = %d", p1, p2, isNewCall);
    TRACE_STACK_USAGE();

    if (isNewCall) {
        explicit_bzero(ctx, SIZEOF(*ctx));
        TRACE("SHA_256_init");
        sha_256_init(&ctx->hashContext);
        TRACE("Integrity check init");
        integrityCheckInit(&ctx->integrity);
        TRACE("Counted sections init");
        countedSectionInit(&ctx->countedSections);
        TRACE("Storage init");
        explicit_bzero(&ctx->storage, SIZEOF(ctx->storage));
        ctx->storage.initialized_magic = TX_STORAGE_INITIALIZED_MAGIC;
        ctx->initWasCalledMagic = TX_INIT_WAS_CALLED_INITIALIZED_MAGIC;
    }
    VALIDATE(TX_INIT_WAS_CALLED_INITIALIZED_MAGIC, ERR_INVALID_DATA);

    // Parse APDU into const and non-const part
    ASSERT(wireDataSize < BUFFER_SIZE_PARANOIA);
    VALIDATE(wireDataSize >= 2, ERR_INVALID_DATA);
    uint8_t constantDataLen = wireDataBuffer[0];
    uint8_t variableDataLen = wireDataBuffer[1];
    VALIDATE(wireDataSize >= (size_t) 2 + constantDataLen + variableDataLen, ERR_INVALID_DATA);
    uint8_t* constantData = wireDataBuffer + 2;
    uint8_t* variableData = constantData + constantDataLen;

    {
        // Update integrity and transaction hash
        integrityCheckProcessInstruction(&ctx->integrity, p1, p2, constantData, constantDataLen);
    }

    subhandler_fn_t* subhandler = lookup_subhandler(p1);
    VALIDATE(subhandler != NULL, ERR_INVALID_REQUEST_PARAMETERS);

    subhandler(p2, constantData, constantDataLen, variableData, variableDataLen);
}

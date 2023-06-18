#include <tree_sitter/parser.h>

enum TokenType {
    START_DELIMITER,
    END_DELIMITER,
    STRING_CONTENT,
    STRING_SINGLE_QUOTED_CONTENT,
    STRING_QQ_QUOTED_CONTENT,
    STRING_DOUBLE_QUOTED_CONTENT,
    START_DELIMITER_QW,
    ELEMENT_IN_QW,
    END_DELIMITER_QW,
    START_DELIMITER_REGEX,
    REGEX_PATTERN,
    END_DELIMITER_REGEX,
    START_DELIMITER_SEARCH_REPLACE,
    SEARCH_REPLACE_CONTENT,
    SEPARATOR_DELIMITER_SEARCH_REPLACE,
    END_DELIMITER_SEARCH_REPLACE,
    START_DELIMITER_TRANSLITERATION,
    TRANSLITERATION_CONTENT,
    SEPARATOR_DELIMITER_TRANSLITERATION,
    END_DELIMITER_TRANSLITERATION,
    POD_CONTENT,
};

typedef struct {
    /* int32_t get_end_delimiter() { return end_delimiter; } */
    int32_t end_delimiter;
} Delimiter;

typedef struct {
    int32_t start_delimiter;
    int32_t end_delimiter;
    bool is_separator_delimiter_parsed;
    bool is_delimiter_enclosing; // is the delimiter {}, <> and same character
                                 // not //, !!
    int delimiter_cout;
    bool reached;
} Scanner;

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

// runs over spaces like a champ
static void run_over_spaces(TSLexer *lexer) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
           lexer->lookahead == '\r' || lexer->lookahead == '\n') {
        skip(lexer);
    }
}

// runs with the spaces using advance
static void run_with_spaces(TSLexer *lexer) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
           lexer->lookahead == '\r' || lexer->lookahead == '\n') {
        advance(lexer);
    }
}

static bool handle_interpolation(Scanner *scanner, TSLexer *lexer,
                                 enum TokenType surrounding_token) {
    if (lexer->lookahead == '$') {
        // allow $ to be last character in a regex
        if (surrounding_token == SEARCH_REPLACE_CONTENT ||
            surrounding_token == REGEX_PATTERN) {
            advance(lexer);
            run_with_spaces(lexer);
            if (lexer->lookahead == scanner->end_delimiter) {
                lexer->result_symbol = surrounding_token;
                lexer->mark_end(lexer);
                return true;
            }
        }
        return false;
    }

    return false;
}

static void set_end_delimiter(Scanner *scanner) {
    // round, angle, square, curly
    scanner->is_delimiter_enclosing = true;
    if (scanner->start_delimiter == '(') {
        scanner->end_delimiter = ')';
    } else if (scanner->start_delimiter == '<') {
        scanner->end_delimiter = '>';
    } else if (scanner->start_delimiter == '[') {
        scanner->end_delimiter = ']';
    } else if (scanner->start_delimiter == '{') {
        scanner->end_delimiter = '}';
    } else {
        scanner->is_delimiter_enclosing = false;
        scanner->end_delimiter = scanner->start_delimiter;
    }
}

// Give a token type, parses the start delimiter,
// and keeps track of it in memory.
static bool parse_start_delimiter(Scanner *scanner, TSLexer *lexer,
                                  enum TokenType token_type) {
    run_over_spaces(lexer);

    scanner->start_delimiter = lexer->lookahead;
    set_end_delimiter(scanner);

    // for substitute and tr/y usecase
    scanner->is_separator_delimiter_parsed = false;

    lexer->result_symbol = token_type;
    advance(lexer);
    lexer->mark_end(lexer);

    return true;
}

static bool handle_escape_sequence(TSLexer *lexer,
                                   enum TokenType surrounding_token) {
    // escape sequences, only basic support as of now
    if (lexer->lookahead == '\\') {
        advance(lexer);
        // also, self end delimiter will be treated as string
        if (lexer->lookahead == 't' || lexer->lookahead == 'n' ||
            lexer->lookahead == 'r' || lexer->lookahead == 'f' ||
            lexer->lookahead == 'b' || lexer->lookahead == 'a' ||
            lexer->lookahead == 'e') {
            // advance(lexer);
            lexer->mark_end(lexer);
            return false;
        }
        lexer->result_symbol = surrounding_token;
        advance(lexer);
        lexer->mark_end(lexer);
        return true;
    }
    return false;
}

static bool scan_nested_delimiters(Scanner *scanner, TSLexer *lexer,
                                   enum TokenType token_type) {
    while (lexer->lookahead) {
        if (lexer->lookahead == scanner->end_delimiter) {
            lexer->result_symbol = token_type;
            advance(lexer);
            lexer->mark_end(lexer);
            return true;
        }
        if (lexer->lookahead == scanner->start_delimiter) {
            lexer->result_symbol = token_type;
            advance(lexer);
            scan_nested_delimiters(scanner, lexer, token_type);
        } else if (lexer->lookahead == '\\') {
            advance(lexer);
            advance(lexer);
        } else {
            advance(lexer);
        }
    }
    lexer->mark_end(lexer);
    return false;
}

static bool
parse_delimited_and_interpolated_content(Scanner *scanner, TSLexer *lexer,
                                         enum TokenType token_type,
                                         enum TokenType ending_delimiter) {
    if (lexer->lookahead == scanner->end_delimiter) {
        lexer->result_symbol = ending_delimiter;
        advance(lexer);
        lexer->mark_end(lexer);
        return true;
    }
    // oh boy! the interpolation
    if (lexer->lookahead == '$') {
        return handle_interpolation(scanner, lexer, token_type);
    }
    // escape sequences, only basic support as of now
    if (lexer->lookahead == '\\') {
        return handle_escape_sequence(lexer, token_type);
    }

    if (!lexer->lookahead) {
        lexer->mark_end(lexer);
        return false;
    }

    // handling nested delimiters qq { hello { from { the}}};
    if (lexer->lookahead == scanner->start_delimiter) {
        lexer->result_symbol = token_type;
        advance(lexer);
        return scan_nested_delimiters(scanner, lexer, token_type);
    }

    lexer->result_symbol = token_type;
    advance(lexer);
    lexer->mark_end(lexer);
    return true;

    // shouldn't reach here
    return false;
}

static bool process_separator_delimiter(Scanner *scanner, TSLexer *lexer,
                                        enum TokenType separator_token,
                                        enum TokenType end_token) {
    if (scanner->is_separator_delimiter_parsed) {
        lexer->result_symbol = end_token;
        advance(lexer);
        lexer->mark_end(lexer);
        return true;
    }
    lexer->result_symbol = separator_token;
    advance(lexer);
    lexer->mark_end(lexer);

    // if delimiter is {}, (), <>, []
    if (scanner->is_delimiter_enclosing) {
        run_over_spaces(lexer);

        if (lexer->lookahead == scanner->start_delimiter) {
            lexer->result_symbol = separator_token;
            advance(lexer);
            lexer->mark_end(lexer);

            scanner->is_separator_delimiter_parsed = true;

            return true;
        }

        return false;
    }
    scanner->is_separator_delimiter_parsed = true;

    return true;

    return false;
}

static bool scan(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols) {
    // on ERROR, external scanner is called with all valid_symbols to be
    // true. so for our usecase we need this logic. ref -
    // https://github.com/tree-sitter/tree-sitter/issues/1128
    if (valid_symbols[START_DELIMITER] && valid_symbols[END_DELIMITER] &&
        valid_symbols[STRING_CONTENT] &&
        valid_symbols[STRING_SINGLE_QUOTED_CONTENT] &&
        valid_symbols[STRING_QQ_QUOTED_CONTENT] &&
        valid_symbols[STRING_DOUBLE_QUOTED_CONTENT] &&
        valid_symbols[START_DELIMITER_QW] && valid_symbols[END_DELIMITER_QW] &&
        valid_symbols[START_DELIMITER_REGEX] && valid_symbols[REGEX_PATTERN] &&
        valid_symbols[END_DELIMITER_REGEX] &&
        valid_symbols[START_DELIMITER_SEARCH_REPLACE] &&
        valid_symbols[SEARCH_REPLACE_CONTENT] &&
        valid_symbols[SEPARATOR_DELIMITER_SEARCH_REPLACE] &&
        valid_symbols[END_DELIMITER_SEARCH_REPLACE] &&
        valid_symbols[START_DELIMITER_TRANSLITERATION] &&
        valid_symbols[TRANSLITERATION_CONTENT] &&
        valid_symbols[SEPARATOR_DELIMITER_TRANSLITERATION] &&
        valid_symbols[END_DELIMITER_TRANSLITERATION] &&
        valid_symbols[POD_CONTENT]) {
        return false;
    }

    if (valid_symbols[STRING_SINGLE_QUOTED_CONTENT]) {
        // end when you reach the final single quote '
        if (lexer->lookahead == '\'') {
            lexer->mark_end(lexer);
            advance(lexer);
            return false;
        }
        // check for escaped single quote \'
        if (lexer->lookahead == '\\') {
            lexer->result_symbol = STRING_SINGLE_QUOTED_CONTENT;
            advance(lexer);

            if (lexer->lookahead == '\'') {
                advance(lexer);
            }
            lexer->mark_end(lexer);
            return true;
        }

        // some exit conditions
        if (!lexer->lookahead) {
            lexer->mark_end(lexer);
            return false;
        }

        lexer->result_symbol = STRING_SINGLE_QUOTED_CONTENT;
        advance(lexer);
        lexer->mark_end(lexer);

        return true;
    }

    // TODO: handle qqqSTRINGq; - this should throw error
    if (valid_symbols[START_DELIMITER]) {
        return parse_start_delimiter(scanner, lexer, START_DELIMITER);
    }

    if (valid_symbols[STRING_QQ_QUOTED_CONTENT]) {
        return parse_delimited_and_interpolated_content(
            scanner, lexer, STRING_QQ_QUOTED_CONTENT, END_DELIMITER);
    }

    if (valid_symbols[STRING_DOUBLE_QUOTED_CONTENT]) {
        if (lexer->lookahead == '"') {
            lexer->mark_end(lexer);
            advance(lexer);
            return false;
        }

        // oh boy! the interpolation
        if (lexer->lookahead == '$') {
            return handle_interpolation(scanner, lexer,
                                        STRING_DOUBLE_QUOTED_CONTENT);
        }
        // escape sequences, only basic support as of now
        if (lexer->lookahead == '\\') {
            return handle_escape_sequence(lexer, STRING_DOUBLE_QUOTED_CONTENT);
        }

        // some exit conditions
        if (!lexer->lookahead) {
            lexer->mark_end(lexer);
            return false;
        }

        lexer->result_symbol = STRING_DOUBLE_QUOTED_CONTENT;
        advance(lexer);
        lexer->mark_end(lexer);
        return true;
    }

    if (valid_symbols[START_DELIMITER_QW]) {
        return parse_start_delimiter(scanner, lexer, START_DELIMITER_QW);
    }

    if (valid_symbols[ELEMENT_IN_QW]) {
        run_over_spaces(lexer);

        if (lexer->lookahead == scanner->end_delimiter) {
            lexer->result_symbol = END_DELIMITER_QW;
            advance(lexer);
            lexer->mark_end(lexer);
            return true;
        }

        // exit condition
        if (!lexer->lookahead) {
            lexer->mark_end(lexer);
            return false;
        }

        while (lexer->lookahead // exit condition
               && lexer->lookahead != ' ' && lexer->lookahead != '\t' &&
               lexer->lookahead != '\r' && lexer->lookahead != '\n' &&
               lexer->lookahead != scanner->end_delimiter) {
            lexer->result_symbol = ELEMENT_IN_QW;
            advance(lexer);
        }

        lexer->mark_end(lexer);
        return true;
    }

    if (valid_symbols[START_DELIMITER_REGEX]) {
        return parse_start_delimiter(scanner, lexer, START_DELIMITER_REGEX);
    }
    if (valid_symbols[REGEX_PATTERN]) {
        return parse_delimited_and_interpolated_content(
            scanner, lexer, REGEX_PATTERN, END_DELIMITER_REGEX);
    }

    if (valid_symbols[START_DELIMITER_SEARCH_REPLACE]) {
        return parse_start_delimiter(scanner, lexer,
                                     START_DELIMITER_SEARCH_REPLACE);
    }

    if (valid_symbols[SEARCH_REPLACE_CONTENT]) {
        if (lexer->lookahead == scanner->end_delimiter) {
            return process_separator_delimiter(
                scanner, lexer, SEPARATOR_DELIMITER_SEARCH_REPLACE,
                END_DELIMITER_SEARCH_REPLACE);
        }
        // oh boy! the interpolation
        if (lexer->lookahead == '$') {
            return handle_interpolation(scanner, lexer, SEARCH_REPLACE_CONTENT);
        }
        // escape sequences, only basic support as of now
        if (lexer->lookahead == '\\') {
            return handle_escape_sequence(lexer, SEARCH_REPLACE_CONTENT);
        }

        // some exit conditions
        if (!lexer->lookahead) {
            lexer->mark_end(lexer);
            return false;
        }

        // handling nested delimiters qq { hello { from { the}}};
        if (lexer->lookahead == scanner->start_delimiter) {
            lexer->result_symbol = SEARCH_REPLACE_CONTENT;
            advance(lexer);
            return scan_nested_delimiters(scanner, lexer,
                                          SEARCH_REPLACE_CONTENT);
        }

        lexer->result_symbol = SEARCH_REPLACE_CONTENT;
        advance(lexer);
        return true;
    }

    if (valid_symbols[START_DELIMITER_TRANSLITERATION]) {
        return parse_start_delimiter(scanner, lexer,
                                     START_DELIMITER_TRANSLITERATION);
    }
    if (valid_symbols[TRANSLITERATION_CONTENT]) {
        if (lexer->lookahead == scanner->end_delimiter) {
            return process_separator_delimiter(
                scanner, lexer, SEPARATOR_DELIMITER_TRANSLITERATION,
                END_DELIMITER_TRANSLITERATION);
        }

        // exit condition
        if (!lexer->lookahead) {
            lexer->mark_end(lexer);
            return false;
        }

        // escape sequence
        if (lexer->lookahead == '\\') {
            lexer->result_symbol = TRANSLITERATION_CONTENT;
            advance(lexer);
            // self end delimiter
            if (lexer->lookahead == scanner->end_delimiter) {
                advance(lexer);
            }

            lexer->mark_end(lexer);
            return true;
        }

        // handling nested delimiters qq { hello { from { the}}};
        if (lexer->lookahead == scanner->start_delimiter) {
            lexer->result_symbol = TRANSLITERATION_CONTENT;
            advance(lexer);
            return scan_nested_delimiters(scanner, lexer,
                                          TRANSLITERATION_CONTENT);
        }

        lexer->result_symbol = TRANSLITERATION_CONTENT;
        advance(lexer);
        lexer->mark_end(lexer);
        return true;
    }

    if (valid_symbols[POD_CONTENT]) {
        while (lexer->lookahead) {
            lexer->result_symbol = POD_CONTENT;

            // if it is =cut that marks the end of pod content
            if (lexer->lookahead == '=') {
                lexer->advance(lexer, false);
                if (lexer->lookahead == 'c') {
                    lexer->advance(lexer, false);
                    if (lexer->lookahead == 'u') {
                        lexer->advance(lexer, false);
                        if (lexer->lookahead == 't') {
                            lexer->advance(lexer, false);
                            lexer->mark_end(lexer);
                            return true;
                        }
                    }
                }
            } else {
                lexer->advance(lexer, false);
            }
        }

        // or if it end of the file also, mark the end of pod content
        lexer->mark_end(lexer);
        return true;
    }

    return false;
}

void *tree_sitter_perl_external_scanner_create() {
    Scanner *scanner = (Scanner *)calloc(1, sizeof(Scanner));
    return scanner;
}

unsigned tree_sitter_perl_external_scanner_serialize(void *payload,
                                                     char *buffer) {
    return 0;
}

void tree_sitter_perl_external_scanner_deserialize(void *payload,
                                                   const char *buffer,
                                                   unsigned length) {}

bool tree_sitter_perl_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
    Scanner *scanner = (Scanner *)payload;
    return scan(scanner, lexer, valid_symbols);
}

void tree_sitter_perl_external_scanner_destroy(void *payload) {
    Scanner *scanner = (Scanner *)payload;
    free(scanner);
}

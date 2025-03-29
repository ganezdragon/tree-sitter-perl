// the constant contains the order of precedence.
// the lower the value, higher the precedence.
const PRECEDENCE = {
  // A TERM has the highest precedence in Perl.
  // They include variables, quote and quote-like operators, any expression in parentheses,
  // and any function whose arguments are parenthesized
  TERM: 100,
  ARROW_OPERATOR: 99,
  COMMENTS: 98, // comments over anything. Except in strings or regex.


  // begin of operators
  AUTO_INCREMENT_DECREMENT: 80,
  EXPONENTIATION: 79,
  SYMBOLIC_UNARY: 78,
  BINDING_OPERATORS: 77,
  BODMAS_1: 76,
  BODMAS_2: 75,
  SHIFT_OPERATORS: 74,
  RELATIONAL_OPERATORS: 73,
  EQUALITY_OPERATORS: 72,
  ISA_OPERATOR: 71,
  BITWISE_AND: 70,
  BITWISE_OR_XOR: 69,
  LOGICAL_AND: 68,
  LOGICAL_ORS: 67,
  RANGE_OPERATOR: 66,
  TERNARY_OPERATOR: 65,
  ASSIGNMENT_OPERATORS: 64,
  COMMA_OPERATORS: 63,
  UNARY_NOT: 62,
  UNARY_AND: 61,
  OR_XOR: 60,
  // end of operators

  HASH: 12,
  ARRAY: 11,

  ESCAPE_SEQ: 10,

  LOWEST: 1
};

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check
module.exports = grammar({
  name: 'perl',

  inline: $ => [
    $.semi_colon,
  ],

  conflicts: $ => [

    [$._auto_increment_decrement],
    
    [$._range_exp],
    [$._class_instance_exp],

    [$.package_name],
    [$.hash_ref],
    [$.array],
    [$.hash_ref, $.block],
    [$.parenthesized_argument, $.array],
    [$.function_prototype, $.array],
    [$.array_access_variable, $.array_ref],
    [$._variables, $.array_dereference],
    [$.hash_ref, $.array_dereference],
  ],

  externals: $ => [
    $._scalar_variable_external,
    $._start_delimiter,
    $._end_delimiter,
    $._string_content,
    $._string_single_quoted_content,
    $._string_single_q_quoted_content,
    $._string_qq_quoted_content,
    $._string_double_quoted_content,
    $._start_delimiter_qw,
    $._element_in_qw,
    $._end_delimiter_qw,
    $._start_delimiter_regex,
    $._start_delimiter_slash,
    $._regex_pattern, // supports interpolation
    $._end_delimiter_regex,
    $._start_delimiter_search_replace,
    $._search_replace_content,
    $._separator_delimiter_search_replace,
    $._end_delimiter_search_replace,
    $._start_delimiter_transliteration,
    $._transliteration_content,
    $._separator_delimiter_transliteration,
    $._end_delimiter_transliteration,
    // heredocs
    $._imaginary_heredoc_start,
    $.heredoc_start_identifier,
    $._heredoc_content,
    $.heredoc_end_identifier,
    // end of heredocs
    $._pod_content,
    $.data_not_for_compiler,
    $._automatic_semicolon,
  ],
  
  extras: $ => [
    $.comments,
    /[\s\uFEFF\u2060\u200B\u00A0]/,
  ],

  precedences: $ => [

  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => prec(PRECEDENCE.LOWEST, choice(
      $.package_statement,

      $.use_no_statement,
      $.use_no_if_statement,
      $.bareword_import,
      $.use_no_subs_statement,
      $.use_no_feature_statement,
      $.use_no_version,
      $.require_statement,

      $.use_constant_statement,

      $.use_parent_statement,

      $._expression_statement,

      $._declaration,

      $.single_line_statement,

      $._compound_statement,

      $.standalone_block,

      $.ellipsis_statement,
      $.special_block,

      $.heredoc_body_statement,

      $.pod_statement,

      $.label,

      // custom grammar
      $.call_expression_with_sub, // for Method::Signatures::Simple syntaxes
    )),

    // pseudocode
    // ------------
    // have start identifier as external. then parse till end of line
    // then \n, then start hereodc body.
    heredoc_initializer: $ => prec(PRECEDENCE.TERM, seq(
      $._heredoc_operator,
      $.heredoc_start_identifier,
    )),

    _heredoc_operator: $ => '<<',

    heredoc_body_statement: $ => prec(PRECEDENCE.TERM, seq(
      $._imaginary_heredoc_start, // just to track between initializer and body start
      repeat(choice(
        $.interpolation,
        $.escape_sequence,
        $._heredoc_content,
      )),
      $.heredoc_end_identifier
    )),

    pod_statement: $ => prec(PRECEDENCE.COMMENTS, seq(
      /=[\w]+/,
      $._pod_content,
    )),

    special_literal: $ => prec(PRECEDENCE.LOWEST, choice(
      '__FILE__',
      '__LINE__',
      '__PACKAGE__',
      '__SUB__',
      seq(
        choice(
          '__END__',
          '__DATA__',
        ),
        choice(
          $.data_not_for_compiler,
          $.pod_statement,
        ),
      ),
    )),

    use_parent_statement: $ => seq(
      'use',
      'parent',
      optional(seq($.no_require, ',')),
      choice(
        commaSeparated($, $._string),
        $.word_list_qw,
      ),
      $.semi_colon,
    ),

    use_constant_statement: $ => seq(
      'use',
      'constant',
      choice(
        seq(
          field('constant', choice($.identifier, $._string)), $._comma_operator, field('value', $._expression)
        ),
        field('value', $.hash_ref),
      ),
      $.semi_colon,
    ),

    special_block: $ => seq(
      optional('sub'), // but this is often frowned upon
      choice(
        'BEGIN', 'UNITCHECK', 'CHECK', 'INIT', 'END',
      ),
      field('body', $.block),
    ),

    package_statement: $ => seq(
      'package',
      $.package_name,
      optional(field('version', $.version)),
      choice(
        $.semi_colon,
        field('body', $.block)
      )
    ),

    ellipsis_statement: $ => prec.left(seq(
      '...',
      optional($.semi_colon), // TODO: is it optional?
    )),

    use_no_version: $ => seq(
      choice(
        field('use', 'use'),
        field('no', 'no'),
      ),
      field('version', $.version),
      $.semi_colon,
    ),
    
    use_no_feature_statement: $ => seq(
      choice(
        field('use', 'use'),
        field('no', 'no'),
      ),
      'feature',
      optional(choice($._list, $._string)),
      $.semi_colon,
    ),

    _expression_or_return_expression: $ => choice(
      $._expression,
      $.return_expression,
    ),

    // aka _statement_modifiers_expression
    single_line_statement: $ => prec.left(seq(
      $._expression_or_return_expression,
      $._statement_modifiers,
    )),

    _statement_modifiers: $ => choice(
      $.if_simple_statement,
      $.unless_simple_statement,
      $.while_simple_statement,
      $.until_simple_statement,
      $.for_simple_statement,
      $.when_simple_statement,
    ),

    _compound_statement: $ => choice(
      // conditional statements
      $.if_statement,
      $.unless_statement,
      // $.given_statement,

      // loops
      $.while_statement,
      $.until_statement,
      $.for_statement_1,
      $.for_statement_2,
    ),

    _expression_statement: $ => seq(
      commaSeparated($, $._expression),
      $.semi_colon,
    ),

    use_no_statement: $ => seq(
      choice(
        field('use', 'use'),
        field('no', 'no'),
      ),
      field('package_name', choice($.package_name, $.module_name)),
      optional($.version),
      optional(choice($._list, $._string)),
      $.semi_colon,
    ),

    use_no_if_statement: $ => prec.right(seq(
      choice(
        field('use', 'use'),
        field('no', 'no'),
      ),
      'if',
      choice(
        $.parenthesized_argument,
        $._expression,
        $.block,
      ),
      prec.left(PRECEDENCE.COMMA_OPERATORS,
        seq(
          $._comma_operator,
          field('package_name', choice($.package_name, $.module_name, $._string)), // TODO: should this be optional?
          optional($.version),
          optional(
            prec.right(seq(
              $._comma_operator,
              choice($._list, $._string),
            ),
          )),
        ),
      ),
      $.semi_colon,
    )),

    // Module->import( LIST );
    bareword_import: $ => prec(PRECEDENCE.ARROW_OPERATOR, seq(
      field('module', $.identifier),
      '->',
      'import',
      $._list,
      $.semi_colon,
    )),

    use_no_subs_statement: $ => seq(
      choice(
        field('use', 'use'),
        field('no', 'no'),
      ),
      'subs',
      $._list,
      $.semi_colon,
    ),

    require_statement: $ => seq(
      'require',
      field('package_name', $.package_name),
      $.semi_colon,
    ),

    if_simple_statement: $ => prec.left(seq(
      $._if_simple,
      $.semi_colon,
    )),
    _if_simple: $ => prec.left(seq(
      'if',
      field('condition', $._argument_choice),
    )),
    unless_simple_statement: $ => prec.left(seq(
      'unless',
      field('condition', $._argument_choice),
      $.semi_colon,
    )),
    while_simple_statement: $ => prec.left(seq(
      'while',
      field('condition', $._argument_choice),
      $.semi_colon,
    )),
    until_simple_statement: $ => prec.left(seq(
      'until',
      field('condition', $._argument_choice),
      $.semi_colon,
    )),
    for_simple_statement: $ => prec.left(seq(
      choice('for', 'foreach'),
      field('list', $._argument_choice),
      $.semi_colon,
    )),
    when_simple_statement: $ => prec.left(seq(
      'when',
      field('condition', $._argument_choice),
      $.semi_colon,
    )),

    // TODO: should be a boolean expression and not the current one?
    if_statement: $ => prec.left(seq(
      'if',
      field('condition', $.array),
      field('consequence', $.block),
      repeat(field('alternative', $.elsif_clause)),
      optional(field('alternative', $.else_clause)),
    )),

    unless_statement: $ => prec.left(seq(
      'unless',
      field('condition', $.array),
      field('consequence', $.block),
      repeat(field('alternative', $.elsif_clause)),
      optional(field('alternative', $.else_clause)),
    )),

    elsif_clause: $ => seq(
      'elsif',
      field('condition', $.array),
      field('alternative_if_consequence', $.block),
    ),

    else_clause: $ => seq(
      'else',
      field('alternative', $.block),
    ),

    // given_statement: $ => seq(
    //   'given',
    //   '(',
    //   field('value', choice($.scalar_variable, $._scalar_type)),
    //   ')',
    //   field('body', $.given_body),
    // ),

    // given_body: $ => seq(
    //   'when',
    //   $.array,
    //   $.block,
    // ),

    while_statement: $ => seq(
      optional($.label),
      'while',
      field('condition', $.array),
      field('body', $.block),
      optional(field('flow', $.continue)),
    ),

    continue: $ => seq(
      'continue',
      field('body', $.block),
    ),

    until_statement: $ => seq(
      optional($.label),
      'until',
      field('condition', $.array),
      field('body', $.block),
      optional(field('flow', $.continue)),
    ),

    // the C - style for loop
    for_statement_1: $ => seq(
      optional($.label),
      choice('for', 'foreach'),
      $._for_parenthesize,
      field('body', $.block),
    ),

    for_statement_2: $ => seq(
      optional($.label),
      choice('for', 'foreach'),
      optional(choice(
        seq(optional($.scope), $.scalar_variable),
        seq('\\', optional($.scope), $.hash_variable), // \my %hash
      )),
      $.array,      
      field('body', $.block),
      optional(field('flow', $.continue)),
    ),

    _for_parenthesize: $ => choice(
      seq(
        '(',
        field('initializer', $._expression),
        $.semi_colon,
        field('condition', $._expression),
        $.semi_colon,
        field('incrementor', $._expression),
        ')'
      ),
      seq(
        '(',
        $.semi_colon,
        $.semi_colon,
        ')'
      )
    ),

    _declaration: $ => choice(
      $.function_definition,
      // moving variable_declaration to expression
    ),

    variable_declaration: $ => prec.left(PRECEDENCE.TERM, seq(
      $.scope,
      // multi declaration
      // or single declaration without brackets
      choice(
        // $.multi_var_declaration,
        $.array, // TODO: it should be $.multi_var_declaration
        $._variable_dec,
      ),
      // optional($._initializer),
    )),

    multi_var_declaration: $ => with_brackets(commaSeparated($, $._variable_dec)),

    _variable_dec: $ => field('variable_name', choice($._variables, $._access_variables)),

    // _initializer: $ => prec.right(PRECEDENCE.ASSIGNMENT_OPERATORS, seq(
    //   '=',
    //   field('value', $._expression),
    // )),
    
    scope: $ => prec.right(choice(
      'our',
      'state',
      'my',
      'local',
    )),

    _function_options: $ => prec.left(
      choice(
        seq(
          $.function_prototype,
          optional($.function_attribute),
        ),
        seq(
          optional($.function_prototype),
          $.function_attribute,
        ),
        seq(
          $.function_prototype,
          optional($._function_signature),
        ),
        seq(
          optional($.function_prototype),
          $._function_signature,
        ),
        seq(
          ':', 'prototype',
          $.function_prototype,
          $._function_signature,
        ),
      ),
    ),

    // why perl, why!
    function_definition: $ => prec.left(seq(
      optional($.scope),
      'sub',
      field('name', $.identifier),
      optional($._function_options),
      choice(
        $.semi_colon,
        field('body', $.block),
      ),
    )),

    function_definition_without_sub: $ => prec.left(PRECEDENCE.LOWEST, seq(
      field('name', $.identifier),
      optional($._function_options),
      // choice(
      //   $.semi_colon,
        field('body', $.block),
      // ),
    )),

    anonymous_function: $ => seq(
      'sub',
      optional(seq($._function_options, $.semi_colon)),
      field('body', $.block),
    ),

    block: $ => prec.left(PRECEDENCE.TERM, seq(
      '{',
      repeat(choice($._statement, $._block_statements)),
      '}',
      optional($.semi_colon), // TODO: make semi_colon just appear anywhere
    )),

    _function_signature: $ => alias($.array, $.function_signature),

    function_prototype: $ => prec(PRECEDENCE.TERM, seq(
      '(',
      optional($.prototype),
      ')',
    )),
    prototype: $ => /[&$@%;*\[\]\\]+/, // (\[$@%;&*])
 
    // sub test2 : Path('/') Args(0) {}
    // colon and space are separators
    // basically they are :call_expressions()
    function_attribute: $ => seq(
      ':',
      repeat1(
        seq(
          $.identifier,
          optional($._function_signature),
        )
      )
    ),

    standalone_block: $ => prec.left(PRECEDENCE.TERM, seq(
      optional($.label),
      $.block,
      optional(field('flow', $.continue)),
      optional($.semi_colon),
    )),

    label: $ => prec(PRECEDENCE.COMMENTS, seq(
      field('label', $.identifier),
      ':',
    )),

    _block_statements: $ => choice(
      // $._statement,
      // commaSeparated($, $._expression),
      seq($.return_expression, $.semi_colon),
      $.loop_control_statement,
    ),

    loop_control_statement: $ => seq(
      $.loop_control_keyword,
      optional(field('label', $.identifier)),
      choice(
        $._statement_modifiers,
        $.semi_colon
      ),
    ),

    return_expression: $ => prec.left(seq(
      'return',
      optional(commaSeparated($, $._expression)),
    )),

    // _expression_without_array: $ => prec(PRECEDENCE.LOWEST, choice(
    // )),

    _expression_without_l_value: $ => prec(PRECEDENCE.LOWEST, choice(
      $._primitive_expression,
      $._string,
      $._variables,
      $._access_variables,
      // $.array_access_complex,
      // $.hash_access_complex,
      $.special_scalar_variable,
      $._dereference,
      $.length_expression,
      $.package_variable,

      $.binary_expression,
      $.unary_expression,
      $.ternary_expression,
    )),

    _expression_without_bareword: $ => prec(PRECEDENCE.LOWEST, choice(
      $.call_expression_with_args_with_brackets,
      $.call_expression_with_variable,
      $.call_expression_with_spaced_args,
      $.call_expression_recursive,
      $.method_invocation,

      // quote-like operators
      $.command_qx_quoted,
      $.backtick_quoted,
      $.pattern_matcher_m,
      $.regex_pattern_qr,
      $.substitution_pattern_s,
      $.transliteration_tr_or_y,
      $.heredoc_initializer,
      $.pattern_matcher,

      $._i_o_operator,

      $.special_literal,

      $.anonymous_function,


      // object oriented stuffs
      $.bless,

      $.variable_declaration,

      $.keywords_in_hash_key,

      $.goto_expression,

      $._expression_without_l_value,

    )),

    _expression: $ => prec(PRECEDENCE.LOWEST, choice(
      $._expression_without_bareword,

      $.call_expression_with_bareword,
    )),

    // array_function: $ => prec.right(PRECEDENCE.TERM, seq(
    //   $.call_expression_with_bareword,
    //   $.block,
    //   commaSeparated($, $._expression),
    // )),

    // TODO: the output tree is wrong for this. fix it.
    package_variable: $ => seq(
      alias(seq(
        $._variables,
        token.immediate('::'),
        repeat(seq($.identifier, '::')),
      ), $.package_name),
      alias($.identifier, $.scalar_variable),
    ),

    // push_function: $ => prec.right(PRECEDENCE.TERM, seq(
    //   alias('push', $.push),
    //   with_or_without_brackets(commaSeparated($._expression)),
    // )),

    // grep_or_map_function: $ => prec.right(PRECEDENCE.TERM, seq(
    //   choice(
    //     alias('grep', $.grep),
    //     alias('map', $.map),
    //   ),
    //   choice(
    //     seq($.list_block, $._expression),
    //     with_or_without_brackets(commaSeparated($._expression)),
    //   ),
    // )),

    // join_function: $ => prec.right(PRECEDENCE.TERM, seq(
    //   choice(
    //     alias('join', $.join),
    //   ),
    //   with_or_without_brackets(commaSeparated($._expression)),
    // )),

    // reverse_function: $ => prec.right(PRECEDENCE.TERM, seq(
    //   alias('reverse', $.reverse),
    //   optional(with_or_without_brackets(commaSeparated($._expression))),
    // )),

    // sort_function: $ => prec.right(PRECEDENCE.TERM, seq(
    //   alias('sort', $.sort),
    //   choice(
    //     $._expression,
    //     seq($.list_block, $._expression),
    //     seq($.call_expression_with_args_without_brackets, $._expression),
    //   ),
    // )),

    // unpack_function: $ => prec.right(PRECEDENCE.TERM, seq(
    //   alias('unpack', $.alias),
    //   with_or_without_brackets(commaSeparated($._expression)),
    // )),

    // TODO: this needs more cases coverage
    // list_block: $ => seq(
    //   '{',
    //   repeat1(choice($._statement, $._expression_without_bareword)),
    //   '}'
    // ),

    bless: $ => prec.right(seq(
      'bless',
      with_or_without_brackets(
        seq(
          field('self', $._reference),
          optional(seq(
            ',',                            // comma separated
            field('class', $._expression),
          )),
        ),
      ),
    )),

    goto_expression: $ => prec.right(PRECEDENCE.ASSIGNMENT_OPERATORS, seq(
      'goto',
      choice(
        $.label,
        field('expression', $._expression),
        field('subroutine', $.call_expression_with_spaced_args),
      ),
    )),

    // begin of operators

    binary_expression: $ => choice(
      $._exponentiation,
      $._binding_expression,
      $._bodmas_1,
      $._bodmas_2,
      $._shift_expression,
      $._relational_expression,
      $._equality_expression,
      $._class_instance_exp,
      $._bitwise_and_exp,
      $._bitwise_or_xor_exp,
      $._logical_and_exp,
      $._logical_ors_exp,
      $._range_exp,
      $._assignment_exp,
      $._logical_verbal_or_xor,
    ),

    unary_expression: $ => choice(
      $._auto_increment_decrement,
      $._symbolic_unary,
      // TODO: named_unary_expression
      $._unary_not,
      $._unary_and,

      $.file_handle_operator,
    ),

    ternary_expression: $ => prec.right(PRECEDENCE.TERNARY_OPERATOR, seq(
      field('condition', $._expression),
      field('operator', '?'),
      field('true', $._expression),
      field('operator', ':'),
      field('false', $._expression),
    )),

    // no associativity
    // auto increment and auto decrement
    _auto_increment_decrement: $ => prec(PRECEDENCE.AUTO_INCREMENT_DECREMENT, choice(
      seq(
        field('variable', $._expression_without_l_value),
        field('operator', choice('++', '--')),
      ),
      seq(
        field('operator', choice('++', '--')),
        field('variable', $._expression_without_l_value),
      ),
    )),

    // It binds even more tightly than unary minus, so -2**4 is -(2**4), not (-2)**4
    _exponentiation: $ => prec.right(PRECEDENCE.EXPONENTIATION, seq(
      field('variable', $._expression),
      field('operator', '**'),
      field('variable', $._expression),
    )),

    _symbolic_unary: $ => prec.right(PRECEDENCE.SYMBOLIC_UNARY, choice(
      seq(
        field('operator', '!'),
        field('variable', $._expression),
      ),
      seq(
        field('operator', '~'),
        field('variable', $._expression),
      ),
      $.to_reference,
      seq(
        field('operator', '+'),
        field('variable', $._expression),
      ),
      seq(
        field('operator', '-'),
        field('variable', $._expression),
      ),
    )),

    _binding_expression: $ => prec.left(PRECEDENCE.BINDING_OPERATORS, choice(
      seq(
        field('variable', $._expression),
        field('operator', '=~'),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', '!~'),
        field('variable', $._expression),
      ),
    )),

    _bodmas_1: $ => prec.left(PRECEDENCE.BODMAS_1, choice(
      seq(
        field('variable', $._expression),
        field('operator', '*'),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', /\//),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', /%/),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        choice(
          seq(
            field('operator', /x/),
            field('variable', $._expression),
          ),
          seq(
            field('operator_variable', /x[0-9]/),
          )
        )
      ),
    )),

    _bodmas_2: $ => prec.left(PRECEDENCE.BODMAS_2, choice(
      seq(
        field('variable', $._expression),
        field('operator', '+'),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', '-'),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', '.'),
        field('variable', $._expression),
      ),
    )),

    _shift_expression: $ => prec.left(PRECEDENCE.SHIFT_OPERATORS, choice(
      seq(
        field('variable', $._expression_without_bareword),
        field('operator', '<<'),
        field('variable', $._expression_without_bareword),
      ),
      seq(
        field('variable', $._expression),
        field('operator', '>>'),
        field('variable', $._expression),
      ),
    )),

    // has chaining. example: $a > $b > $c
    _relational_expression: $ => prec.left(PRECEDENCE.RELATIONAL_OPERATORS, seq(
      field('variable', $._expression),
      repeat1(seq(
        choice(
          '<',
          '>',
          '<=',
          '>=',
          'lt',
          'gt',
          'le',
          'ge',
        ),
        $._expression,
      ))
    )),

    // first few has chaining
    _equality_expression: $ => prec.left(PRECEDENCE.EQUALITY_OPERATORS, choice(
      seq(
        field('variable', $._expression),
        repeat1(seq(
          choice(
            '==',
            '!=',
            'eq',
            'ne',
          ),
          $._expression,
        ))
      ),
      seq(
        field('variable', $._expression),
        field('operator', '<=>'),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', 'cmp'),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', '~~'),
        field('variable', $._expression),
      ),
    )),

    _class_instance_exp: $ => prec(PRECEDENCE.ISA_OPERATOR, seq(
      field('variable', $._expression),
      field('operator', 'isa'),
      field('variable', $._expression),
    )),

    _bitwise_and_exp: $ => prec.left(PRECEDENCE.BITWISE_AND, seq(
      field('variable', $._expression),
      field('operator', /&/),
      field('variable', $._expression),
    )),

    _bitwise_or_xor_exp: $ => prec.left(PRECEDENCE.BITWISE_OR_XOR, choice(
      seq(
        field('variable', $._expression),
        field('operator', '|'),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', '^'),
        field('variable', $._expression),
      ),
    )),

    _logical_and_exp: $ => prec.left(PRECEDENCE.LOGICAL_AND, seq(
      field('variable', $._expression),
      field('operator', '&&'),
      field('variable', $._expression),
    )),

    _logical_ors_exp: $ => prec.left(PRECEDENCE.LOGICAL_ORS, choice(
      seq(
        field('variable', $._expression),
        field('operator', '||'),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', '//'),
        field('variable', $._expression),
      ),
    )),

    _range_exp: $ => prec(PRECEDENCE.RANGE_OPERATOR, choice(
      seq(
        field('variable', $._expression),
        field('operator', '..'),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', '...'),
        field('variable', $._expression),
      ),
    )),

    // **=    +=    *=    &=    &.=    <<=    &&=
    //    -=    /=    |=    |.=    >>=    ||=
    //    .=    %=    ^=    ^.=           //=
    //          x=
    _assignment_exp: $ => prec.right(PRECEDENCE.ASSIGNMENT_OPERATORS, choice(
      ...[
        '=',
        '**=',
        '+=',
        '*=',
        '&=',
        '&.=',
        '<<=',
        '&&=',
        '-=',
        '/=',      
        '|=',
        '|.=',
        '>>=',
        '||=',
        '.=',
        '%=',
        '^=',
        '^.=',
        '//=',
        'X=',
      ].map((operator) => 
        seq(
          field('variable', $._expression),
          field('operator', operator),
          field('variable', $._expression),
        ),
      )
    )),

    _unary_not: $ => prec.right(PRECEDENCE.UNARY_NOT, seq(
      field('operator', 'not'),
      field('variable', $._expression),
    )),

    _unary_and: $ => prec.left(PRECEDENCE.UNARY_AND, seq(
      optional(field('variable', $._expression)),
      field('operator', 'and'),
      field('variable', $._expression),
    )),

    _logical_verbal_or_xor: $ => prec.left(PRECEDENCE.OR_XOR, choice(
      seq(
        field('variable', $._expression),
        field('operator', 'or'),
        field('variable', $._expression),
      ),
      seq(
        field('variable', $._expression),
        field('operator', 'xor'),
        field('variable', $._expression),
      )
    )),

    // file handle operators
    // ref - https://perldoc.perl.org/functions/-X
    file_handle_operator: $ => prec.left(PRECEDENCE.UNARY_NOT, seq(
      field('operator', /-[rwxoRWXOezsfdlpSbctugkTBMAC]/),
      field('variable', $._expression),
    )),

    // end of operators

    _i_o_operator: $ => choice(
      $.standard_input,
      $.file_handle,
      $.standard_input_to_identifier,
      $.standard_input_to_variable,
    ),
    standard_input: $ => choice(
      /<>/,
      /<<>>/,
      /<STDIN>/,
      /\\\*STDIN/, // a reference to the STDIN
    ),
    file_handle: $ => /<FILEHANDLE>/,
    standard_input_to_identifier: $ => seq(
      '<',
      $.identifier,
      token.immediate('>'),
    ),
    standard_input_to_variable: $ => seq(
      '<',
      $.scalar_variable,
      token.immediate('>'),
    ),

    // begin of function calls

    // from https://perldoc.perl.org/perlsub#Prototypes
    // An & requires an anonymous subroutine, which, if passed as the first argument, may look like a bare block: It does not require the sub keyword or a subsequent comma.
    call_expression_with_spaced_args: $ => prec.left(PRECEDENCE.LOWEST, seq(
      $.call_expression_with_bareword,
      field('args', choice(
        seq(
          // map, grep
          choice(
            $.block,
            $.scalar_variable,
          ),
          $.arguments,
        ),

        choice($.block, $.arguments),
      )),
    )),

    call_expression_with_sub: $ => prec.left(PRECEDENCE.LOWEST, seq(
      choice('method', 'func', $.call_expression_with_bareword),
      field('args', $.function_definition_without_sub),
    )),

    call_expression_with_args_with_brackets: $ => prec.left(PRECEDENCE.TERM, seq(
      $.call_expression_with_bareword,
      optional(field('args', $.array)),
    )),

    // call_expression_with_args_without_brackets: $ => prec.left(PRECEDENCE.LOWEST, seq(
    //   $.call_expression_with_bareword,
    //   field('args', $.arguments),
    // )),

    call_expression_with_variable: $ => prec.left(PRECEDENCE.TERM, seq(
      choice(
        seq($._and_before_sub, with_or_without_curly_brackets($._variables)),
        seq($._and_before_sub, with_curly_brackets($._access_variables)),
        // $._access_variables,
      ),
      optional(field('args', $.array)),
    )),

    // call_expression_with_bareword: $ => prec.left(PRECEDENCE.LOWEST, seq(
    //   $._call_expression_common,
    // )),

    call_expression_with_bareword: $ => prec.left(PRECEDENCE.LOWEST, seq(
      optional($._and_before_sub),
      optional(seq(
        field('package_name', $.package_name),
        token.immediate('::'),
      )),
      field('function_name', choice(
        $.identifier,
      )),
    )),

    _and_before_sub: $ => prec.left(PRECEDENCE.LOWEST, /&/),

    method_invocation: $ => prec.left(PRECEDENCE.ARROW_OPERATOR, seq(
      choice(
        field('package_name', choice($.identifier, $.package_name, $.string_single_quoted)),
        field('object', $.scalar_variable),
        field('string', $._interpolatable_string),
        field('object_return_value', getLValueRules($)),
      ),
      $.arrow_operator,
      choice(
        seq(
          optional(seq($.super, token.immediate('::'))),
          field('function_name', choice(
            $.identifier,
          )),
        ),
        $.special_scalar_variable,
        $.scalar_variable,
        $.scalar_dereference,
        $.array, // for passing it to the previous item in the chain
      ),
      // anything with bracket is higher precedence.
      // so args without brackets is lower precedence.
      optional(field('args', $.parenthesized_argument)),
    )),

    _argument_choice: $ => prec(PRECEDENCE.COMMA_OPERATORS, choice(
      $.parenthesized_argument,
      $.arguments,
    )),

    parenthesized_argument: $ => prec.left(PRECEDENCE.TERM, 
      with_brackets(optional($.arguments)),
    ),

    arguments: $ => prec.right(PRECEDENCE.COMMA_OPERATORS,
      commmaSeparatedWithoutOuterBrackets($, $._expression),
    ),

    spaced_arguments: $ => prec.right(PRECEDENCE.LOWEST, seq(
      choice($.block, $._expression),
      $._expression,
    )),

    call_expression_recursive: $ => seq(
      '__SUB__',
      field('operator', '->'),
      $.array,
    ),

    // end of function calls

    _primitive_expression: $ => choice(
      // data-types
      $._scalar_type,
      
      $._boolean,

      $._array_type,
    ),

    _variables: $ => prec.left(PRECEDENCE.TERM, choice(
      $.scalar_variable,
      $.typeglob,
      $.special_scalar_variable,
      $.package_variable,
      $.array_variable,
      $.hash_variable,
    )),

    _access_variables: $ => choice(
      $.hash_access_variable_simple,
      $.hash_access_variable,
      $.array_access_variable,
    ),

    _scalar_type: $ => choice(
      $.string_single_quoted,
      $.string_q_quoted,
      // TODO: handle escape sequences
      $.string_double_quoted,
      $.string_qq_quoted,
      $._numeric_literals,
      $.array_ref,
      $.hash_ref,

      // remove here since its already declared
      // $.array_access_variable,
      // $.hash_access_variable,
    ),

    // the strings
    _string: $ => prec.left(PRECEDENCE.TERM, choice(
      $.string_single_quoted,
      $.string_q_quoted,
      $.string_double_quoted,
      $.string_qq_quoted,
      $.heredoc_initializer,
    )),

    _interpolatable_string: $ => choice(
      $.string_double_quoted,
      $.string_qq_quoted,
    ),

    _resolves_to_digit: $ => choice(
      $.string_single_quoted,
      $.string_q_quoted,
      // TODO: handle escape sequences
      $.string_qq_quoted,
      $._numeric_literals,
    ),

    _array_type: $ => choice(
      $.array,
      $.word_list_qw,
    ),
    
    _numeric_literals: $ => choice(
      $.integer,
      $.floating_point,
      $.scientific_notation,
      $.hexadecimal,
      $.octal,
    ),

    integer: $ => /-?\d+/,
    floating_point: $ => /-?\d+\.\d+/,
    // copied shamelessly from https://stackoverflow.com/questions/638565/parsing-scientific-notation-sensibly
    scientific_notation: $ => /[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/,
    hexadecimal: $ => /0[xX][0-9a-fA-F]+/,
    octal: $ => /0[1-7][0-7]*/,

    version: $ => choice(
      /v[\d.]+/,  // v5.24.1
      /[\d.]+/,   // 5.24.1
      /[\d._]+/, // 5.024_001 older syntax compatible with perl 5.6
    ),

    identifier: $ => /[a-zA-Z0-9_]+/,
    // bareword: $ => /[a-zA-Z0-9_$]+/,

    // any characters or just bareword(s) and variables
    identifier_2: $ => /[a-zA-Z0-9_$:\.@%\^]+/,

    // TODO: this should be operators. Check.
    loop_control_keyword: $ => prec(PRECEDENCE.ASSIGNMENT_OPERATORS, choice(
      'next',
      'last',
      'redo',
    )),

    package_name: $ => choice(
      $.identifier,
      seq(
        $.identifier,
        repeat1(seq(
          token.immediate('::'),
          $.identifier,
        )),
      ),
      // /[A-Z_a-z][0-9A-Z_a-z]*(?:::[0-9A-Z_a-z]+)*/,
      // /\$[0-9A-Z_a-z]*(?:::[0-9A-Z_a-z]+)*/, // TODO fix this
      // /\*[0-9A-Z_a-z]*(?:::[0-9A-Z_a-z]+)*/, // type glob stuff
      // TODO: put in other package name structures
    ),

    module_name: $ => choice(
      seq('\'', /.*pm/, '\''), 
      seq('\"', /.*pm/, '\"'), 
     ),

    semi_colon: $ => choice(';', $._automatic_semicolon),

    string_single_quoted: $ => prec(PRECEDENCE.TERM, seq(
      "'",
      repeat($._string_single_quoted_content),
      "'",
    )),

    string_q_quoted: $ => prec(PRECEDENCE.TERM, seq(
      'q',
      alias($._start_delimiter, $.start_delimiter),
      repeat($._string_single_q_quoted_content),
      alias($._end_delimiter, $.end_delimiter),
    )),

    string_double_quoted: $ => prec(PRECEDENCE.TERM, seq(
      '"',
      repeat(choice($.interpolation, $.escape_sequence, $._string_double_quoted_content)),
      '"',
    )),

    string_qq_quoted: $ => prec(PRECEDENCE.TERM, seq(
      'qq',
      alias($._start_delimiter, $.start_delimiter),
      repeat(choice($._string_qq_quoted_content, $.interpolation, $.escape_sequence)),
      alias($._end_delimiter, $.end_delimiter),
    )),

    command_qx_quoted: $ => prec(PRECEDENCE.TERM, seq(
      'qx',
      choice(
        $.string_single_quoted, // TODO: this is not working
        seq(
          alias($._start_delimiter, $.start_delimiter),
          repeat(choice($._string_qq_quoted_content, $.interpolation, $.escape_sequence)),
          alias($._end_delimiter, $.end_delimiter),
        ),
      ),
    )),

    // same as command_qx_quoted
    backtick_quoted: $ => prec(PRECEDENCE.TERM, seq(
      '`',
      repeat(choice($.interpolation, $.escape_sequence, token(/[^`]+/))),
      '`',
    )),

    word_list_qw: $ => prec(PRECEDENCE.TERM, seq(
      'qw',
      alias($._start_delimiter_qw, $.start_delimiter_qw),
      repeat(alias($._element_in_qw, $.list_item)),
      alias($._end_delimiter_qw, $.end_delimiter_qw),
    )),

    pattern_matcher_m: $ => prec(PRECEDENCE.TERM, seq(
      'm',
      // /'.*'/, // don't interpolate for a single quote. TODO: not working
      alias($._start_delimiter_regex, $.start_delimiter),
      repeat(choice($._regex_pattern, $.interpolation, $.escape_sequence)),
      alias($._end_delimiter_regex, $.end_delimiter),
      optional($.regex_option),
    )),

    pattern_matcher: $ => prec.right(PRECEDENCE.TERM, seq(
      // TODO: currently doesn't parse interpolation.
      '/',
      optional($.regex_pattern_content),
      '/',
      optional($.regex_option),
    )),

    regex_pattern_qr: $ => prec.left(PRECEDENCE.TERM, seq(
      'qr',
      // /'.*'/, // don't interpolate for a single quote. TODO: not working
      alias($._start_delimiter_regex, $.start_delimiter),
      repeat(choice($._regex_pattern, $.interpolation, $.escape_sequence)),
      alias($._end_delimiter_regex, $.end_delimiter),
      optional($.regex_option),
    )),

    substitution_pattern_s: $ => prec(PRECEDENCE.TERM, seq(
      's',
      alias($._start_delimiter_search_replace, $.start_delimiter),
      repeat(choice($._search_replace_content, $.interpolation, $.escape_sequence)),
      alias($._separator_delimiter_search_replace, $.separator_delimiter),
      repeat(choice($._search_replace_content, $.interpolation, $.escape_sequence)),
      alias($._end_delimiter_search_replace, $.end_delimiter),
      field('regex_option', optional($.regex_option_for_substitution)),
    )),

    // TODO: revisit this
    transliteration_tr_or_y: $ => prec(PRECEDENCE.TERM, seq(
      choice('tr', 'y'),
      alias($._start_delimiter_transliteration, $.start_delimiter),
      repeat($._transliteration_content),
      alias($._separator_delimiter_transliteration, $.separator_delimiter),
      repeat($._transliteration_content),
      alias($._end_delimiter_transliteration, $.end_delimiter),
      field('regex_option', optional($.regex_option_for_transliteration)),
    )),

    // shamelessly copied from the tree-sitter-javascript
    regex_pattern_content: $ => prec.dynamic(PRECEDENCE.TERM, repeat1(
      choice(
        seq(
          '[',
          repeat(choice(
            seq('\\', /./), // escaped character
            /[^\]\n\\]/       // any character besides ']' or '\n'
          )),
          ']'
        ),              // square-bracket-delimited character class
        seq('\\', /./), // escaped character
        /[^/\\\[\n]/,   // any character besides '[', '\', '/', '\n'
        seq(optional('\\'), '#')      // forcing #, so that it doesn't go into perl comments
      ),
    )),

    regex_option: $ => token.immediate(/[msixpodualng]+/),
    regex_option_for_substitution: $ => token.immediate(/[msixpodualngcer]+/),
    regex_option_for_transliteration: $ => token.immediate(/[cdsr]+/),

    // https://perldoc.perl.org/perlop#Quote-and-Quote-like-Operators
    escape_sequence: $ => prec(PRECEDENCE.ESCAPE_SEQ, seq(
      '\\',
      /[tnrfbae]/,
    )),

    // escape_character: $ => '\\[.]+',

    interpolation: $ => choice(
      $._variables,
      $.scalar_dereference,
      $.hash_access_in_interpolation,
      $.array_access_in_interpolation,
      // $.function_call_in_interpolation,
    ),

    // print "${\(hello())}";
    // function_call_in_interpolation: $ => seq(
    //   '$', '{', '\\{', '(',
    //   $.call_expression_with_args_without_brackets,
    //   ')', '}'
    // ),

    hash_access_in_interpolation: $ => prec(PRECEDENCE.HASH, seq(
      $.scalar_variable,
      repeat1(seq(
        optional($.arrow_operator),
        '{',
        field('hash_key', choice($.identifier, $.scalar_variable, $._string)),
        '}',
      )),
    )),

    array_access_in_interpolation: $ => prec(PRECEDENCE.ARRAY, seq(
      $.scalar_variable,
      repeat1(seq(
        choice(
          token.immediate('->['),
          token.immediate('[')
        ),
        token.immediate('['),
        field('index', choice($._resolves_to_digit, $.scalar_variable, $._string)),
        ']',
      )),
    )),

    _boolean: $ => choice(
      $.true,
      $.false,
    ),
    true: $ => 'true',
    false: $ => 'false',

    special_scalar_variable: $ => prec.right(PRECEDENCE.TERM, seq(
      '$', with_or_without_curly_brackets(/#*|[!"#$%&'()*+,-./0123456789:;<=>?@\]\[\\_`|~]/), // NOTE: ab is removed as my $a = 1 is possible
    )),

    scalar_variable: $ => prec.left(PRECEDENCE.TERM, seq(
      '$', with_or_without_curly_brackets($._scalar_variable_external)
    )),

    typeglob: $ => prec(PRECEDENCE.TERM, seq(
      '*', with_or_without_curly_brackets($.identifier),
    )),

    array_access_variable: $ => prec.left(PRECEDENCE.TERM, seq(
      field('array_variable', choice(
        $._variables,
        $.array_dereference,
        $.array_ref,

        $._access_variables,
        // $.hash_access_complex,
        // $.array_access_complex,
        $.array, // TODO: is it replacement of above?

        $.call_expression_with_args_with_brackets,
        $.call_expression_with_variable,
        $.call_expression_with_bareword,
        with_curly_brackets($.call_expression_with_spaced_args),
        $.call_expression_recursive,
        $.method_invocation,

        $.anonymous_function,

        $.scalar_dereference,
      )),
      optional($.arrow_operator),
      '[',
      field('index', commaSeparated($, $._expression)),
      ']',
    )),

    array_access_complex: $ => prec.left(PRECEDENCE.TERM, seq(
      field('array_variable', $.array),
      repeat1(
        prec.right(PRECEDENCE.TERM, seq(
          optional($.arrow_operator),
          '[',
          field('index', commaSeparated($, $._expression)),
          ']',
        ))
      ),
    )),

    hash_access_variable_simple: $ => prec.left(PRECEDENCE.TERM, seq(
      field('hash_variable', getHashKeySimpleLeft($)),
      '{',
      field('key', getHashKeyValues($)),
      // field('key', commaSeparated($, $._expression)),
      '}',
    )),

    hash_access_variable: $ => prec.left(PRECEDENCE.TERM, seq(
      field('hash_variable', getLValueRules($)),
      $.arrow_operator,
      '{',
      // field('key', commaSeparated($, $._expression)),
      field('key', getHashKeyValues($)),
      '}',
    )),

    hash_access_complex: $ => prec.left(PRECEDENCE.TERM, seq(
      field('hash_variable', $.array),
      repeat1(prec.right(
        seq(
          optional($.arrow_operator),
          '{',
          field('key', commaSeparated($, $._expression)),
          '}',
        )
      )),
    )),

    array_variable: $ => prec(PRECEDENCE.TERM, choice(
      /@[+-_!]/,                // special array variable
      /@\^[A-Z]/,               // %^H
      /@[a-zA-Z0-9_]+/
    )),

    hash_variable: $ => prec(PRECEDENCE.TERM, choice(
      /%[!+-]/,                 // special hash variables
      /%\^[A-Z]/,               // %^H
      /%[a-zA-Z0-9_]+/
    )),

    _list: $ => choice(
      $._array_type,
      $.array_variable,
    ),

    array: $ => prec.left(PRECEDENCE.TERM, with_brackets(
      optional(commmaSeparatedWithoutOuterBrackets($, $._expression))
    )),

    array_ref: $ => prec.left(PRECEDENCE.TERM, seq(
      '[',
      optional(commaSeparated($, $._expression)),
      ']',
    )),

    hash_ref: $ => prec.left(PRECEDENCE.TERM, seq(
      optional('+'), // to make into a hash_ref rather than a block
      '{',
      optional(choice($.call_expression_with_spaced_args, commaSeparated($, $._expression))),
      '}'
    )),

    // refer - https://perldoc.perl.org/perlref
    _reference: $ => choice(
      $.array_ref,
      $.hash_ref,
      $.scalar_variable, // doubtful
      $.to_reference,
      $.anonymous_function,
    ),

    to_reference: $ => prec.right(PRECEDENCE.SYMBOLIC_UNARY, seq(
      field('operator', '\\'),
      field('variable', $._expression), // this is to make anything a reference
    )),

    _dereference: $ => prec.right(choice(
      $.scalar_dereference,
      $.array_dereference,
      $.hash_dereference,
    )),

    // ${\(1)}
    // lower precedance than a scalar variable?
    scalar_dereference: $ => prec.right(PRECEDENCE.TERM, seq(
      '$',
      choice(
        with_curly_brackets($._expression),
        with_or_without_curly_brackets($.scalar_dereference),
        with_or_without_curly_brackets($.scalar_variable),
      ),
    )),
    length_expression: $ => prec.right(PRECEDENCE.TERM, seq(
      '$#',
      choice(
        with_curly_brackets($._expression),
        with_or_without_curly_brackets($.identifier),
      ),      
    )),

    array_dereference: $ => prec.right(PRECEDENCE.TERM, seq(
      '@',
      choice(
        with_curly_brackets($._expression),
        with_or_without_curly_brackets($.array_dereference),
        with_or_without_curly_brackets($.scalar_variable),
        with_or_without_brackets($.special_scalar_variable),
        with_or_without_brackets($.hash_access_variable_simple),
        with_or_without_brackets($.hash_access_variable),
      ),
    )),

    hash_dereference: $ => prec.left(PRECEDENCE.TERM ,seq(
      '%',
      choice(
        with_curly_brackets($._expression),
        with_or_without_curly_brackets($.hash_dereference),
        with_or_without_curly_brackets($.scalar_variable),
        with_or_without_brackets($.special_scalar_variable),
        with_or_without_brackets($.hash_access_variable_simple),
        with_or_without_brackets($.hash_access_variable),
      ),
    )),

    // cat => 'meow', meta => {}
    // key_value_pair: $ => prec.left(PRECEDENCE.COMMA_OPERATORS, seq(
    //   field('key', choice(
    //     alias($.identifier, $.bareword),
    //     alias($.keywords_in_hash_key, $.bareword),
    //     $.variable_declaration,
    //     $._expression,
    //   )),
    //   prec.right(seq(
    //     $.hash_arrow_operator,
    //     field('value', $._expression),
    //   )),
    // )),

    keywords_in_hash_key: $ => prec.left(PRECEDENCE.LOWEST, 
      choice(
        'sub',
        'state',
        'for',
      ),
    ),

    // these two are same, but different operators. Check https://perldoc.perl.org/perlobj#Method-Invocation
    arrow_operator: $ => prec.left(PRECEDENCE.ARROW_OPERATOR, '->'),
    method_arrow_operator: $ => prec.left(PRECEDENCE.ARROW_OPERATOR, '->'),

    _comma_operator: $ => prec(PRECEDENCE.COMMA_OPERATORS, choice($.normal_comma, $.fat_comma)),
    normal_comma: $ => ',',
    fat_comma: $ => '=>',

    // some key words
    super: $ => 'SUPER',
    no_require: $ => '-norequire',

    _any_whitespace: $ => choice(
      ' ',
      '\n',
      '\t',
      '\r'
    ),

    // single line comment
    comments: $ => prec(PRECEDENCE.COMMENTS, seq(
      '#', /.*/
    )),

  }
});

/**
 * repeats the rule comma separated, like
 * rule, rule => rule, rule => rule
 * example: my (a, b);
 * using it in the above.
 * @param {*} rule 
 */
function commaSeparated($, rule) {
  return prec.left(PRECEDENCE.COMMA_OPERATORS, seq(
    // rule,
    // repeat(seq($._comma_operator, prec(PRECEDENCE.COMMA_OPERATORS, rule))),
    // optional($._comma_operator), // in perl so far you could have this
    with_or_without_brackets(rule),
    optional(repeat(prec.left(PRECEDENCE.COMMA_OPERATORS, seq($._comma_operator, prec(PRECEDENCE.COMMA_OPERATORS, with_or_without_brackets(rule)))))),
    optional($._comma_operator), // in perl so far you could have this
  ));
}

function commmaSeparatedWithoutOuterBrackets($, rule) {
  return prec.left(PRECEDENCE.COMMA_OPERATORS, seq(
    rule,
    optional(repeat(prec.left(PRECEDENCE.COMMA_OPERATORS, seq($._comma_operator, prec(PRECEDENCE.COMMA_OPERATORS, with_or_without_brackets(rule)))))),
    optional($._comma_operator),
  ));
}

function commaSeparatedNext($, rule) {
  return prec.left(PRECEDENCE.COMMA_OPERATORS, seq(
    optional(repeat(prec.left(PRECEDENCE.COMMA_OPERATORS, seq($._comma_operator, prec(PRECEDENCE.COMMA_OPERATORS, with_or_without_brackets(rule)))))),
    optional($._comma_operator), // in perl so far you could have this
  ));
}

function spaceSeparated($, rule) {
  return prec.left(PRECEDENCE.LOWEST, seq(
    rule,
    // optional($._any_whitespace),
    optional(repeat(prec.left(PRECEDENCE.LOWEST, seq($._any_whitespace, prec(PRECEDENCE.LOWEST, rule))))),
  ));
}

/**
 * Given a rule, returns back a rule with and without
 * brackets on them.
 * 
 * print ("hello"); vs print "hello"
 * 
 * @param {any} rule the rule
 * @returns choice of rules
 */
function with_or_without_brackets(rule) {
  return choice(
    rule,
    prec.left(PRECEDENCE.TERM, seq('(', rule, ')')),
  );
}

function with_brackets(rule) {
  return prec.left(PRECEDENCE.TERM, seq('(', rule, ')'));
}
// TODO: the above should be like this, test it
// function with_or_without_brackets(rule) {
//   return choice(
//     rule,
//     prec(PRECEDENCE.TERM, seq('(', rule, ')')),
//   );
// }

/**
 * Given a rule, returns back a rule with and without
 * curly brackets on them.
 * 
 * @$array vs @{$array}
 * 
 * @param {any} rule the rule
 * @returns choice of rules
 */
 function with_or_without_curly_brackets(rule) {
  return choice(
    rule,
    prec.left(PRECEDENCE.TERM, seq('{', rule, '}')),
  );
}

function with_curly_brackets(rule) {
  return prec.left(PRECEDENCE.TERM, seq('{', rule, '}'));
}

// TODO: should come back to these inbuilt functions later
// ref - https://perldoc.perl.org/functions
// pop ARRAY
function getInBuiltFunctionNames() {
  return choice(
        'abs', 'atan2', 'cos', 'exp', 'hex', 'int', 'log', 'oct', 'rand', 'sin', 'sqrt', 'srand',
        'each', 'keys', 'pop', 'shift', 'values',
        'splice',
        'push', 'unshift', // getInBuiltArrayFunctionNames
        // 'grep', 'map', 'sort', 'reverse', 'sort', 'unpack' // getInBuiltListFunctionNames
  );
}

// push ARRAY,LIST 
function getInBuiltArrayFunctionNames() {
  return choice('push', 'unshift')
}

function getNamedBlockFunctionNames() {
  return choice('eval', 'try', 'catch')
}

// grep BLOCK LIST 
function getInBuiltListFunctionNames() {
  return prec(PRECEDENCE.LOWEST, choice('grep', 'map', 'sort', 'reverse', 'sort', 'unpack'));
}

function getLValueRules($) {
  return choice(
    $._variables,

    $.array_ref,
    $.hash_ref,

    $._access_variables,
    // $.hash_access_complex,
    // $.array_access_complex,
    $.array, // TODO: is it replacement of above?

    $.call_expression_with_args_with_brackets,
    $.call_expression_with_variable,
    $.call_expression_with_bareword,
    with_curly_brackets($.call_expression_with_spaced_args),
    $.call_expression_recursive,
    $.method_invocation,

    $.anonymous_function,

    $.scalar_dereference,
  );
}

function getHashKeyValues($) {
  return choice(
    $.keywords_in_hash_key,
    $.call_expression_with_args_with_brackets,
    // $.call_expression_with_spaced_args,
    $._variables,
    $._string,
    $.binary_expression,
    $._numeric_literals,
    $._access_variables,
    $.method_invocation,
    $.scalar_dereference,
    $.identifier,
  );
}

function getHashKeySimpleLeft($) {
  return choice(
    $.array_variable,
    $.array,
    $._access_variables,
    $.scalar_variable,
    $.hash_dereference,
    $.array_dereference,
    $.package_variable,
  );
}

/**
 * Given a rule, returns back a choice of rule with and
 * without quotes surrounded by the rule.
 * 
 * $hash->{'romantic'} vs $hash->{romantic}
 * 
 * @param {any} rule the rule
 * @returns choice of rules
 */
function with_or_without_quotes(rule) {
  return choice(
    rule,
    seq('\'', rule, '\''),
    seq('"', rule, '"'),
  );
}

// TODO: move this to a custom scanner so that it matches - https://stackoverflow.com/questions/22492028/regex-that-start-and-end-with-same-letter
// /([^a-z]).*\1/,
function delimited_with_interpolation($) {
  return choice(
    
  );
}

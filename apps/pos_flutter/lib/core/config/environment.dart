class Environment {
  const Environment._();

  static const appEnv = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'local',
  );
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');

  static void validate() {
    final missing = <String>[
      if (supabaseUrl.isEmpty) 'SUPABASE_URL',
      if (supabaseAnonKey.isEmpty) 'SUPABASE_ANON_KEY',
      if (apiBaseUrl.isEmpty) 'API_BASE_URL',
    ];
    if (missing.isNotEmpty) {
      throw StateError(
        'Missing required --dart-define values: ${missing.join(', ')}',
      );
    }
  }
}

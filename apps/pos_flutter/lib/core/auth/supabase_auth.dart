import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseAuthRepository {
  SupabaseAuthRepository(this._client);

  final SupabaseClient _client;

  Session? get session => _client.auth.currentSession;
  Stream<AuthState> get authChanges => _client.auth.onAuthStateChange;

  Future<void> signIn({required String email, required String password}) async {
    await _client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signOut() => _client.auth.signOut();
}

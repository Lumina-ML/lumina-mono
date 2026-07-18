__all__ = ['SERVER_FEATURES_QUERY_GQL']
SERVER_FEATURES_QUERY_GQL = '\nquery ServerFeaturesQuery {\n  serverInfo {\n    features {\n      name\n      isEnabled\n    }\n  }\n}\n'

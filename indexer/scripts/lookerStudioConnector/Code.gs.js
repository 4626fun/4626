var cc = DataStudioApp.createCommunityConnector();

var USER_PROPS = PropertiesService.getUserProperties();
var AUTH_KEY_SUPABASE_URL = "supabase_url";
var AUTH_KEY_SUPABASE_TOKEN = "supabase_token";

var SOURCE_VIEW = "v_looker_zora_profiles_ethos";
var SOURCE_PROFILES = "zora_profiles";
var SOURCE_OWNER_CLASS = "zora_csw_owner_class";

var SOURCES = {};
SOURCES[SOURCE_VIEW] = {
  id: SOURCE_VIEW,
  label: "v_looker_zora_profiles_ethos",
  description: "Flattened Zora profile analytics view with Ethos score",
  orderBy: "zora_creator_coin_market_cap.desc.nullslast",
  fields: [
    { name: "handle", label: "Zora Handle", type: "TEXT" },
    { name: "zora_display_name", label: "Display Name", type: "TEXT" },
    { name: "zora_creator_coin_symbol", label: "Coin Ticker", type: "TEXT" },
    { name: "zora_creator_coin_name", label: "Coin Name", type: "TEXT" },
    { name: "zora_creator_coin_address", label: "Creator Coin Address", type: "TEXT" },
    { name: "zora_creator_coin_market_cap", label: "Market Cap USD", type: "NUMBER" },
    { name: "zora_creator_coin_total_volume", label: "Total Volume USD", type: "NUMBER" },
    { name: "unique_holders", label: "Unique Holders", type: "NUMBER" },
    { name: "volume_24h_usd", label: "24h Volume USD", type: "NUMBER" },
    { name: "twitter_username", label: "Twitter Username", type: "TEXT" },
    { name: "twitter_follower_count", label: "Twitter Followers", type: "NUMBER" },
    { name: "farcaster_username", label: "Farcaster Username", type: "TEXT" },
    { name: "farcaster_follower_count", label: "Farcaster Followers", type: "NUMBER" },
    { name: "primary_wallet", label: "Primary Wallet", type: "TEXT" },
    { name: "signing_eoa", label: "Signing EOA", type: "TEXT" },
    { name: "payout_recipient", label: "Payout Recipient", type: "TEXT" },
    { name: "primary_wallet_kind", label: "Primary Wallet Kind", type: "TEXT" },
    { name: "smart_wallet_address", label: "Smart Wallet Address", type: "TEXT" },
    { name: "smart_wallet_kind", label: "Smart Wallet Kind", type: "TEXT" },
    { name: "privy_wallet_address", label: "Privy Wallet Address", type: "TEXT" },
    { name: "privy_wallet_kind", label: "Privy Wallet Kind", type: "TEXT" },
    { name: "recommended_install_source", label: "Install Source", type: "TEXT" },
    { name: "recommended_install_target", label: "Install Target", type: "TEXT" },
    { name: "signing_eoa_source", label: "Signing EOA Source", type: "TEXT" },
    { name: "signing_eoa_balance_wei", label: "Signing EOA Balance (wei)", type: "TEXT" },
    { name: "payout_recipient_balance_wei", label: "Payout Recipient Balance (wei)", type: "TEXT" },
    { name: "is_in_csw_index", label: "In CSW Index", type: "BOOLEAN" },
    { name: "score_wallet", label: "Ethos Score Wallet", type: "TEXT" },
    { name: "ethos_userkey", label: "Ethos Userkey", type: "TEXT" },
    { name: "ethos_score", label: "Ethos Score", type: "NUMBER" },
    { name: "ethos_level", label: "Ethos Level", type: "TEXT" },
    { name: "ethos_score_updated_at", label: "Ethos Updated At", type: "TEXT" },
    { name: "last_refreshed_at", label: "Profile Refreshed At", type: "TEXT" },
  ],
};

SOURCES[SOURCE_PROFILES] = {
  id: SOURCE_PROFILES,
  label: "zora_profiles",
  description: "Raw Zora profile table",
  orderBy: "zora_creator_coin_market_cap.desc.nullslast",
  fields: [
    { name: "handle", label: "Zora Handle", type: "TEXT" },
    { name: "zora_display_name", label: "Display Name", type: "TEXT" },
    { name: "zora_creator_coin_symbol", label: "Coin Ticker", type: "TEXT" },
    { name: "zora_creator_coin_market_cap", label: "Market Cap USD", type: "NUMBER" },
    { name: "zora_creator_coin_total_volume", label: "Total Volume USD", type: "NUMBER" },
    { name: "unique_holders", label: "Unique Holders", type: "NUMBER" },
    { name: "volume_24h_usd", label: "24h Volume USD", type: "NUMBER" },
    { name: "twitter_username", label: "Twitter Username", type: "TEXT" },
    { name: "twitter_follower_count", label: "Twitter Followers", type: "NUMBER" },
    { name: "farcaster_username", label: "Farcaster Username", type: "TEXT" },
    { name: "farcaster_follower_count", label: "Farcaster Followers", type: "NUMBER" },
    { name: "primary_wallet", label: "Primary Wallet", type: "TEXT" },
    { name: "primary_wallet_kind", label: "Primary Wallet Kind", type: "TEXT" },
    { name: "signing_eoa", label: "Signing EOA", type: "TEXT" },
    { name: "recommended_install_source", label: "Install Source", type: "TEXT" },
    { name: "recommended_install_target", label: "Install Target", type: "TEXT" },
    { name: "last_refreshed_at", label: "Profile Refreshed At", type: "TEXT" },
  ],
};

SOURCES[SOURCE_OWNER_CLASS] = {
  id: SOURCE_OWNER_CLASS,
  label: "zora_csw_owner_class",
  description: "Owner-class table with Ethos cache",
  orderBy: "ethos_score.desc.nullslast",
  fields: [
    { name: "eoa", label: "EOA", type: "TEXT" },
    { name: "wallet_class", label: "Wallet Class", type: "TEXT" },
    { name: "mainnet_nonce", label: "Mainnet Tx Count", type: "NUMBER" },
    { name: "base_nonce", label: "Base Tx Count", type: "NUMBER" },
    { name: "farcaster_username", label: "Farcaster Username", type: "TEXT" },
    { name: "farcaster_fid", label: "Farcaster FID", type: "NUMBER" },
    { name: "basename", label: "Basename", type: "TEXT" },
    { name: "ens_name", label: "ENS Name", type: "TEXT" },
    { name: "zora_handle", label: "Zora Handle", type: "TEXT" },
    { name: "zora_creator_coin_address", label: "Creator Coin Address", type: "TEXT" },
    { name: "ethos_userkey", label: "Ethos Userkey", type: "TEXT" },
    { name: "ethos_score", label: "Ethos Score", type: "NUMBER" },
    { name: "ethos_level", label: "Ethos Level", type: "TEXT" },
    { name: "ethos_score_updated_at", label: "Ethos Updated At", type: "TEXT" },
    { name: "last_updated_at", label: "Last Updated At", type: "TEXT" },
  ],
};

function getAuthType() {
  var AuthType = cc.AuthType;
  return cc.newAuthTypeResponse().setAuthType(AuthType.USER_TOKEN).build();
}

function setCredentials(request) {
  var url = (request.username || "").trim();
  var token = (request.password || "").trim();

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    return {
      errorCode: "INVALID_CREDENTIALS",
      errorMessage:
        "Supabase URL must look like https://<project-ref>.supabase.co",
    };
  }

  if (token.length < 20) {
    return {
      errorCode: "INVALID_CREDENTIALS",
      errorMessage: "Service-role key appears invalid.",
    };
  }

  USER_PROPS.setProperty(AUTH_KEY_SUPABASE_URL, url.replace(/\/+$/, ""));
  USER_PROPS.setProperty(AUTH_KEY_SUPABASE_TOKEN, token);
  return { errorCode: "NONE" };
}

function isAuthValid() {
  var url = USER_PROPS.getProperty(AUTH_KEY_SUPABASE_URL);
  var token = USER_PROPS.getProperty(AUTH_KEY_SUPABASE_TOKEN);
  return Boolean(url && token);
}

function resetAuth() {
  USER_PROPS.deleteProperty(AUTH_KEY_SUPABASE_URL);
  USER_PROPS.deleteProperty(AUTH_KEY_SUPABASE_TOKEN);
}

function getConfig() {
  var config = cc.getConfig();
  config
    .newInfo()
    .setId("instructions")
    .setText(
      "Use service-role credentials. For large dashboards, prefer v_looker_zora_profiles_ethos."
    );

  var sourcePicker = config
    .newSelectSingle()
    .setId("source")
    .setName("Supabase source");
  sourcePicker.addOption(
    sourcePicker.newOptionBuilder().setLabel(SOURCES[SOURCE_VIEW].label).setValue(SOURCE_VIEW)
  );
  sourcePicker.addOption(
    sourcePicker.newOptionBuilder().setLabel(SOURCES[SOURCE_PROFILES].label).setValue(SOURCE_PROFILES)
  );
  sourcePicker.addOption(
    sourcePicker
      .newOptionBuilder()
      .setLabel(SOURCES[SOURCE_OWNER_CLASS].label)
      .setValue(SOURCE_OWNER_CLASS)
  );

  config
    .newTextInput()
    .setId("row_limit")
    .setName("Row limit per query")
    .setHelpText("Recommended 2000-10000 depending on chart complexity.")
    .setPlaceholder("5000");

  config.setDateRangeRequired(false);
  return config.build();
}

function getSchema(request) {
  var source = getSourceFromRequest(request);
  return { schema: buildFieldsForSource(source).build() };
}

function getData(request) {
  var source = getSourceFromRequest(request);
  var sourceDef = SOURCES[source];
  var requestedFieldIds = (request.fields || []).map(function (f) {
    return f.name;
  });
  if (!requestedFieldIds.length) {
    requestedFieldIds = sourceDef.fields.map(function (f) {
      return f.name;
    });
  }

  var knownFieldMap = {};
  sourceDef.fields.forEach(function (f) {
    knownFieldMap[f.name] = f;
  });
  var safeFieldIds = requestedFieldIds.filter(function (id) {
    return Boolean(knownFieldMap[id]);
  });

  var allFields = buildFieldsForSource(source);
  var requestedFields = allFields.forIds(safeFieldIds);
  var schema = requestedFields.build();

  var rowLimit = parseRowLimit(request);
  var rows = fetchSupabaseRows(sourceDef, safeFieldIds, rowLimit);

  var outputRows = rows.map(function (row) {
    return {
      values: safeFieldIds.map(function (id) {
        return normalizeCell(row[id], knownFieldMap[id].type);
      }),
    };
  });

  return {
    schema: schema,
    rows: outputRows,
  };
}

function buildFieldsForSource(source) {
  var fields = cc.getFields();
  var types = cc.FieldType;
  SOURCES[source].fields.forEach(function (f) {
    if (f.type === "NUMBER") {
      fields.newMetric().setId(f.name).setName(f.label).setType(types.NUMBER);
    } else if (f.type === "BOOLEAN") {
      fields.newDimension().setId(f.name).setName(f.label).setType(types.BOOLEAN);
    } else {
      fields.newDimension().setId(f.name).setName(f.label).setType(types.TEXT);
    }
  });
  return fields;
}

function getSourceFromRequest(request) {
  var selected = request && request.configParams && request.configParams.source;
  if (selected && SOURCES[selected]) return selected;
  return SOURCE_VIEW;
}

function parseRowLimit(request) {
  var raw = request && request.configParams && request.configParams.row_limit;
  var n = Number(raw || 5000);
  if (!isFinite(n) || n < 1) return 5000;
  if (n > 50000) return 50000;
  return Math.floor(n);
}

function fetchSupabaseRows(sourceDef, fieldIds, rowLimit) {
  var supabaseUrl = USER_PROPS.getProperty(AUTH_KEY_SUPABASE_URL);
  var token = USER_PROPS.getProperty(AUTH_KEY_SUPABASE_TOKEN);
  if (!supabaseUrl || !token) {
    throwConnectorError("Missing Supabase credentials. Reconnect the data source.");
  }

  var pageSize = 1000;
  var offset = 0;
  var out = [];
  var safeSelect = fieldIds.join(",");

  while (offset < rowLimit) {
    var currentLimit = Math.min(pageSize, rowLimit - offset);
    var url =
      supabaseUrl +
      "/rest/v1/" +
      sourceDef.id +
      "?select=" +
      encodeURIComponent(safeSelect) +
      "&order=" +
      encodeURIComponent(sourceDef.orderBy) +
      "&limit=" +
      currentLimit +
      "&offset=" +
      offset;

    var resp = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
      headers: {
        apikey: token,
        Authorization: "Bearer " + token,
      },
    });

    var code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      throwConnectorError(
        "Supabase query failed (" + code + "): " + truncate(resp.getContentText(), 200)
      );
    }

    var body = JSON.parse(resp.getContentText() || "[]");
    if (!Array.isArray(body)) {
      throwConnectorError("Supabase returned unexpected payload.");
    }

    out = out.concat(body);
    if (body.length < currentLimit) break;
    offset += currentLimit;
  }

  return out;
}

function normalizeCell(value, type) {
  if (value === null || value === undefined) return null;

  if (type === "NUMBER") {
    var n = Number(value);
    return isFinite(n) ? n : null;
  }
  if (type === "BOOLEAN") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    if (typeof value === "number") return value !== 0;
    return null;
  }

  return String(value);
}

function truncate(s, maxLen) {
  if (!s || s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "...";
}

function throwConnectorError(message) {
  cc.newUserError()
    .setDebugText(message)
    .setText("Connector failed to query Supabase. Check credentials and source selection.")
    .throwException();
}

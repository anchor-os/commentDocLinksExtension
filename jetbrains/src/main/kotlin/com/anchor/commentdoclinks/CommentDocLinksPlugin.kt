package com.anchor.commentdoclinks

/**
 * Plugin entry-point markers are handled through plugin.xml.
 *
 * This file exists so the package has a stable root and the plugin declares an
 * application-level service that is loaded with the IDE. Functional services
 * (workspace root resolution, navigation, diagnostics, completion) land in
 * later phases under the corresponding sub-packages.
 */

internal const val PLUGIN_ID = "com.anchor.commentdoclinks"
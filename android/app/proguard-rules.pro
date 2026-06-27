# Keep our application class + entry points
-keep class com.construction.manager.** { *; }
-keepattributes *Annotation*, InnerClasses, EnclosingMethod, Signature, Exceptions
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile

# --- Kotlinx Serialization ---
# https://github.com/Kotlin/kotlinx.serialization#android
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault

-keepclassmembers class **$$serializer { *; }
-keepclassmembers class * {
    @kotlinx.serialization.Serializable <fields>;
}
-keep,includedescriptorclasses class com.construction.manager.**$$serializer { *; }
-keepclassmembers class com.construction.manager.** {
    *** Companion;
}
-keepclasseswithmembers class com.construction.manager.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# --- Ktor ---
-keep class io.ktor.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn io.ktor.**
-dontwarn kotlinx.atomicfu.**
-dontwarn org.slf4j.**

# --- Supabase (uses reflection on serializers) ---
-keep class io.github.jan.supabase.** { *; }
-dontwarn io.github.jan.supabase.**

# --- Coil 3 ---
-keep class coil3.** { *; }
-dontwarn coil3.**

# --- Compose ---
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# Strip Log.d/v from release binaries
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
}

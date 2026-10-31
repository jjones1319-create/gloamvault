// The body shader (Phase 12, D-160): the web's characters/material.ts in URP. A hero's or monster's look rides in the
// vertex colour — R = palette slot / 15 (16 slots: skin, skin2, hair, iris, sclera, ink, cloth1–3, leather, metal,
// trim, glow, wood, bone, gem; 11 and 14 emissive), G = body region / 15 (10 regions; a region under armour is cut
// away by _HiddenRegions). Each character has its own material with its own palette. The shared 4-step ramp per
// light over a hemisphere, as the rooms; a thin dark inverted-hull outline as a second pass, about 1.6 px wide on
// the phone and never under 4 mm. Skinning and blend shapes happen before the shader (the SkinnedMeshRenderer).
Shader "Gloamvault/Body"
{
    Properties
    {
        _SkyColor ("Hemisphere sky", Color) = (0.54, 0.47, 0.42, 1)
        _GroundColor ("Hemisphere ground", Color) = (0.12, 0.09, 0.07, 1)
        _Hemi ("Hemisphere strength", Float) = 0.8
        _Alpha ("Alpha", Range(0, 1)) = 1.0
        _HiddenRegions ("Hidden regions (bitmask)", Float) = 0
        _Glow ("Emissive strength", Float) = 1.6
        _OutlineColor ("Outline", Color) = (0.07, 0.047, 0.063, 1)
        _OutlinePx ("Outline width (px)", Float) = 2.2
        _OutlineMin ("Outline width min (m)", Float) = 0.004
        [HideInInspector] _SrcBlend ("Src", Float) = 1
        [HideInInspector] _DstBlend ("Dst", Float) = 0
        [HideInInspector] _ZWrite ("ZWrite", Float) = 1
    }

    SubShader
    {
        Tags { "RenderPipeline" = "UniversalPipeline" "RenderType" = "Opaque" "Queue" = "Geometry" }

        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

        CBUFFER_START(UnityPerMaterial)
            float4 _Palette[16];
            float4 _SkyColor;
            float4 _GroundColor;
            float4 _OutlineColor;
            float _Hemi;
            float _Alpha;
            float _HiddenRegions;
            float _Glow;
            float _OutlinePx;
            float _OutlineMin;
        CBUFFER_END

        float Ramp(float ndl)
        {
            return ndl < 0.22 ? 0.42 : ndl < 0.50 ? 0.68 : ndl < 0.82 ? 0.90 : 1.06;
        }

        bool Hidden(float g)
        {
            int region = (int)round(g * 15.0);
            uint mask = (uint)_HiddenRegions;
            return (mask & (1u << region)) != 0u;
        }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            Cull Back

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float4 color : COLOR; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; float3 normalWS : TEXCOORD1; float4 color : TEXCOORD2; float fogFactor : TEXCOORD3; };

            Varyings Vert(Attributes v)
            {
                Varyings o;
                VertexPositionInputs p = GetVertexPositionInputs(v.positionOS.xyz);
                o.positionCS = p.positionCS;
                o.positionWS = p.positionWS;
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.color = v.color;
                o.fogFactor = ComputeFogFactor(p.positionCS.z);
                return o;
            }

            half4 Frag(Varyings i, bool front : SV_IsFrontFace) : SV_Target
            {
                if (Hidden(i.color.g)) discard;
                int slot = (int)round(i.color.r * 15.0);
                float3 base = _Palette[slot].rgb;
                float3 col;
                if (slot == 11 || slot == 14)
                {
                    col = base * _Glow;
                }
                else
                {
                    float3 n = normalize(i.normalWS);
                    if (!front) n = -n;
                    float3 ambient = lerp(_GroundColor.rgb, _SkyColor.rgb, n.y * 0.5 + 0.5) * _Hemi;
                    float4 shadowCoord = TransformWorldToShadowCoord(i.positionWS);
                    Light main = GetMainLight(shadowCoord);
                    float3 light = main.color * Ramp(dot(n, main.direction)) * main.shadowAttenuation;
                    #if defined(_ADDITIONAL_LIGHTS)
                    uint count = GetAdditionalLightsCount();
                    for (uint k = 0u; k < count; k++)
                    {
                        Light l = GetAdditionalLight(k, i.positionWS, half4(1, 1, 1, 1));
                        float ndl = dot(n, l.direction);
                        float lum = max(1e-3, dot(l.color, float3(0.2126, 0.7152, 0.0722)));
                        float strength = saturate(lum * l.distanceAttenuation) * l.shadowAttenuation * saturate(ndl * 4.0 + 1.0);
                        light += (l.color / lum) * Ramp(ndl) * strength;
                    }
                    #endif
                    col = base * min(ambient + light, 1.35);
                }
                col = MixFog(col, i.fogFactor);
                return half4(col, _Alpha);
            }
            ENDHLSL
        }

        Pass
        {
            Name "Outline"
            Tags { "LightMode" = "SRPDefaultUnlit" }
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            Cull Front

            HLSLPROGRAM
            #pragma vertex OutlineVert
            #pragma fragment OutlineFrag
            #pragma multi_compile_fog

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float4 color : COLOR; };
            struct Varyings { float4 positionCS : SV_POSITION; float g : TEXCOORD0; float fogFactor : TEXCOORD1; };

            Varyings OutlineVert(Attributes v)
            {
                Varyings o;
                float3 positionWS = TransformObjectToWorld(v.positionOS.xyz);
                float3 normalWS = normalize(TransformObjectToWorldNormal(v.normalOS));
                float4 clip = TransformWorldToHClip(positionWS);
                // The hull sits about _OutlinePx pixels out on the phone's 1,080 lines: metres per pixel grow with the
                // depth (clip.w), 0.0014 m per metre of depth at the fight camera's field of view. Capped hard: a hull
                // that inflates (a wrong screen size in a render-to-texture path) would swallow the whole view.
                float width = clamp(_OutlinePx * clip.w * 0.0014, _OutlineMin, 0.02);
                o.positionCS = TransformWorldToHClip(positionWS + normalWS * width);
                o.g = v.color.g;
                o.fogFactor = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 OutlineFrag(Varyings i) : SV_Target
            {
                if (Hidden(i.g)) discard;
                float3 col = MixFog(_OutlineColor.rgb, i.fogFactor);
                return half4(col, _Alpha);
            }
            ENDHLSL
        }

        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            ZWrite On
            ZTest LEqual
            ColorMask 0
            Cull Back

            HLSLPROGRAM
            #pragma vertex ShadowVert
            #pragma fragment ShadowFrag
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"

            float3 _LightDirection;
            float3 _LightPosition;

            struct A { float4 positionOS : POSITION; float3 normalOS : NORMAL; float4 color : COLOR; };
            struct V { float4 positionCS : SV_POSITION; float g : TEXCOORD0; };

            V ShadowVert(A v)
            {
                V o;
                float3 positionWS = TransformObjectToWorld(v.positionOS.xyz);
                float3 normalWS = TransformObjectToWorldNormal(v.normalOS);
                #if defined(_CASTING_PUNCTUAL_LIGHT_SHADOW)
                float3 lightDirectionWS = normalize(_LightPosition - positionWS);
                #else
                float3 lightDirectionWS = _LightDirection;
                #endif
                float4 positionCS = TransformWorldToHClip(ApplyShadowBias(positionWS, normalWS, lightDirectionWS));
                #if UNITY_REVERSED_Z
                positionCS.z = min(positionCS.z, UNITY_NEAR_CLIP_VALUE);
                #else
                positionCS.z = max(positionCS.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                o.positionCS = positionCS;
                o.g = v.color.g;
                return o;
            }

            half4 ShadowFrag(V i) : SV_Target { if (Hidden(i.g)) discard; return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R
            Cull Back

            HLSLPROGRAM
            #pragma vertex DepthVert
            #pragma fragment DepthFrag
            struct A { float4 positionOS : POSITION; float4 color : COLOR; };
            struct V { float4 positionCS : SV_POSITION; float g : TEXCOORD0; };
            V DepthVert(A v) { V o; o.positionCS = TransformObjectToHClip(v.positionOS.xyz); o.g = v.color.g; return o; }
            half4 DepthFrag(V i) : SV_Target { if (Hidden(i.g)) discard; return 0; }
            ENDHLSL
        }
    }
}

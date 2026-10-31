// The room shader (Phase 11, D-158): the web's envMaterial.ts in URP. A kit piece carries its look in one vertex
// colour: R = palette slot / 15 (16 slots; 11 glow and 14 gem are emissive, 15 water), G = light/dark variation
// (0.5 neutral), B = baked ambient occlusion, A = water opacity. Shading is the shared 4-step ramp
// (0.42 / 0.68 / 0.90 / 1.06 at NdotL −1 / 0.22 / 0.50 / 0.82) per light — the main light and the torches (URP
// additional lights, with their shadows) — over a hemisphere ambient. Three variants from one shader by material
// properties: solid, translucent (mist, webs: a fixed alpha, no depth write, both sides) and water (alpha from the
// vertex, a slow caustic). SRP Batcher compatible.
Shader "Gloamvault/Env"
{
    Properties
    {
        _SkyColor ("Hemisphere sky", Color) = (0.54, 0.47, 0.42, 1)
        _GroundColor ("Hemisphere ground", Color) = (0.12, 0.09, 0.07, 1)
        _Hemi ("Hemisphere strength", Float) = 1.0
        _Alpha ("Alpha (translucent)", Range(0, 1)) = 1.0
        _Water ("Water (alpha from the vertex, caustic)", Float) = 0
        _Glow ("Emissive strength", Float) = 1.6
        [HideInInspector] _SrcBlend ("Src", Float) = 1
        [HideInInspector] _DstBlend ("Dst", Float) = 0
        [HideInInspector] _ZWrite ("ZWrite", Float) = 1
        [HideInInspector] _Cull ("Cull", Float) = 2
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
            float _Hemi;
            float _Alpha;
            float _Water;
            float _Glow;
        CBUFFER_END

        // The ramp: a step per band, so a torch's light falls on a wall in four flat tones, never a gradient.
        float Ramp(float ndl)
        {
            return ndl < 0.22 ? 0.42 : ndl < 0.50 ? 0.68 : ndl < 0.82 ? 0.90 : 1.06;
        }
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float4 color : COLOR;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
                float4 color : TEXCOORD2;
                float fogFactor : TEXCOORD3;
            };

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
                int slot = (int)round(i.color.r * 15.0);
                float3 base = _Palette[slot].rgb * (1.0 + (i.color.g - 0.5) * 0.36) * lerp(0.45, 1.0, i.color.b);
                float alpha = _Water > 0.5 ? i.color.a : _Alpha;
                float3 col;
                if (slot == 11 || slot == 14)
                {
                    // Glow and gem: lit by themselves, untouched by the room's light.
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
                        // A torch's strength is capped at the ramp's top (its colour kept), so a wall by a flame is lit, not blown out.
                        float lum = max(1e-3, dot(l.color, float3(0.2126, 0.7152, 0.0722)));
                        float3 tint = l.color / lum;
                        float strength = saturate(lum * l.distanceAttenuation) * l.shadowAttenuation * saturate(ndl * 4.0 + 1.0);
                        light += tint * Ramp(ndl) * strength;
                    }
                    #endif
                    col = base * min(ambient + light, 1.35);
                    if (_Water > 0.5)
                    {
                        // The web's caustic: a slow shimmer in world space over the knee-deep water.
                        float c = 0.5 + 0.5 * sin(i.positionWS.x * 2.3 + _Time.y * 1.1) * sin(i.positionWS.z * 2.7 - _Time.y * 0.9);
                        col += base * c * 0.25;
                    }
                }
                col = MixFog(col, i.fogFactor);
                return half4(col, alpha);
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
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex ShadowVert
            #pragma fragment ShadowFrag
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"

            float3 _LightDirection;
            float3 _LightPosition;

            struct A { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct V { float4 positionCS : SV_POSITION; };

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
                return o;
            }

            half4 ShadowFrag(V i) : SV_Target { return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R
            Cull [_Cull]

            HLSLPROGRAM
            #pragma vertex DepthVert
            #pragma fragment DepthFrag

            struct A { float4 positionOS : POSITION; };
            struct V { float4 positionCS : SV_POSITION; };

            V DepthVert(A v) { V o; o.positionCS = TransformObjectToHClip(v.positionOS.xyz); return o; }
            half4 DepthFrag(V i) : SV_Target { return 0; }
            ENDHLSL
        }
    }
}

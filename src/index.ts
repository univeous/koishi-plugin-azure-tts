import { Context, h, Schema } from 'koishi'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'

export const name = 'azure-tts'
export const usage = `
## 插件说明
> 通过 Microsoft Azure 认知语音服务提供 TTS 功能。
请参考[先决条件](https://learn.microsoft.com/zh-cn/azure/cognitive-services/speech-service/get-started-text-to-speech?source=recommendations&tabs=windows%2Cterminal&pivots=programming-language-javascript#prerequisites)获取资源密钥。
`

export interface Config {
  speechKey?: string,
  speechRegion?: string,
  defaultLang?: string,
  defaultVoiceName?: string,
  defaultRate?: number,
  defaultPitch?: number,
}

export const Config: Schema<Config> = Schema.object({
  speechKey: Schema.string().description("资源密钥").required().role('secret'),
  speechRegion: Schema.string().description("位置/区域").required(),
  defaultLang: Schema.string().description("默认语言").default("en-US"),
  defaultVoiceName: Schema.string().description("默认语音").default("en-US-AshleyNeural"),
  defaultRate: Schema.percent().description("默认说话速度").default(1.0).role('').min(0.0).max(3.0).step(0.01),
  defaultPitch: Schema.percent().description("默认音调").default(1.0).role('').min(0.0).max(2.0).step(0.02)
})

export function apply(ctx: Context, config: Config) {
  const speechConfig = sdk.SpeechConfig.fromSubscription(config.speechKey, config.speechRegion)

  ctx.command('tts <message:text>', '通过 Microsoft Azure 认知语音服务提供 TTS 功能')
    .usage('lang和voice的取值请参照：\n支持的语言:https://learn.microsoft.com/zh-cn/azure/cognitive-services/speech-service/language-support?tabs=tts#supported-languages')
    .option('lang', '-l [lang]', { fallback: config.defaultLang })
    .option('voice', '-v [voice]', { fallback: config.defaultVoiceName })
    .option('rate', '-r [rate] 说话速度', { fallback: config.defaultRate })
    .option('pitch', '-p [pitch] 音调', { fallback: config.defaultPitch })
    .example("tts -l en-US -v en-US-AshleyNeural -r 1 -p 1.52 gymbag")
    .action(async ({ session, options }, message) => {
      if(!message) return session.execute("help tts")
      
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig)

      const ssml = `
      <speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="${options.lang}">
        <voice name="${options.voice}">
          <prosody rate="${(options.rate - 1) * 100}%" pitch="${(options.pitch - 1) * 50}%">${message}</prosody>
        </voice>
      </speak>
`

      synthesizer.speakSsmlAsync(ssml, (result) => {
        synthesizer.close()
        if (result.reason == sdk.ResultReason.SynthesizingAudioCompleted){
          if(result.audioDuration == 0){
            session.sendQueued('无语音输出。请检查输入文本语言是否与语音语言匹配。')
            return
          }
          
          session.sendQueued(h.audio(result.audioData, "audio/x-wav"))
        }
        else session.sendQueued(result.errorDetails)
      }, err => session.sendQueued(err))

    })
}

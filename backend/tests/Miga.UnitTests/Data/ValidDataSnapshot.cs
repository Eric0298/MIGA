using System.Text.Json.Nodes;

namespace Miga.UnitTests.Data;

internal static class ValidDataSnapshot
{
    internal const string GoalId = "11111111-1111-4111-8111-111111111111";
    internal const string SessionId = "22222222-2222-4222-8222-222222222222";
    internal const string VideoMaterialId = "33333333-3333-4333-8333-333333333333";
    internal const string PdfMaterialId = "44444444-4444-4444-8444-444444444444";
    internal const string VideoBlobId = "55555555-5555-4555-8555-555555555555";
    internal const string PdfBlobId = "66666666-6666-4666-8666-666666666666";
    internal const string VideoLinkId = "77777777-7777-4777-8777-777777777777";
    internal const string PdfLinkId = "88888888-8888-4888-8888-888888888888";
    internal const string VideoProgressId = "99999999-9999-4999-8999-999999999999";
    internal const string PdfProgressId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    internal const string NoteId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    internal const string QuestionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    internal const string CorrectAnswerId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    internal const string IncorrectAnswerId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    internal const string QuestionsAttemptId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    internal const string PdfAttemptId = "01234567-89ab-4cde-8fab-0123456789ab";

    internal static JsonObject Create()
    {
        return JsonNode
            .Parse(
                $$"""
                {
                  "version": 7,
                  "exportedAt": 1700000100000,
                  "goals": [
                    {
                      "id": "{{GoalId}}",
                      "name": "Seguridad web",
                      "targetMinutes": 120,
                      "scheduledDays": ["2026-07-23", "2026-07-24"],
                      "createdAt": 1700000000000,
                      "updatedAt": 1700000001000
                    }
                  ],
                  "sessions": [
                    {
                      "id": "{{SessionId}}",
                      "goalId": "{{GoalId}}",
                      "startedAt": 1700000010000,
                      "pausedAt": null,
                      "endedAt": 1700000070000,
                      "totalPausedMs": 0,
                      "status": "completed",
                      "createdAt": 1700000010000,
                      "updatedAt": 1700000070000,
                      "materialIds": ["{{VideoMaterialId}}"]
                    }
                  ],
                  "materials": [
                    {
                      "id": "{{VideoMaterialId}}",
                      "kind": "video-youtube",
                      "title": "OWASP overview",
                      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                      "metadata": {
                        "provider": "youtube",
                        "youtubeVideoId": "dQw4w9WgXcQ",
                        "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
                        "author": "MIGA",
                        "durationSeconds": 213
                      },
                      "createdAt": 1700000002000,
                      "updatedAt": 1700000002000
                    },
                    {
                      "id": "{{PdfMaterialId}}",
                      "kind": "pdf",
                      "title": "Apuntes de seguridad",
                      "fileBlobKey": "{{PdfBlobId}}",
                      "metadata": {
                        "provider": "pdf",
                        "totalPages": 10,
                        "mimeType": "application/pdf",
                        "fileSizeBytes": 1024
                      },
                      "createdAt": 1700000003000,
                      "updatedAt": 1700000003000
                    }
                  ],
                  "materialGoalLinks": [
                    {
                      "id": "{{VideoLinkId}}",
                      "materialId": "{{VideoMaterialId}}",
                      "goalId": "{{GoalId}}",
                      "createdAt": 1700000004000
                    },
                    {
                      "id": "{{PdfLinkId}}",
                      "materialId": "{{PdfMaterialId}}",
                      "goalId": "{{GoalId}}",
                      "createdAt": 1700000004000
                    }
                  ],
                  "materialProgress": [
                    {
                      "id": "{{VideoProgressId}}",
                      "materialId": "{{VideoMaterialId}}",
                      "goalId": "{{GoalId}}",
                      "sessionId": "{{SessionId}}",
                      "kind": "video-youtube",
                      "totalWatchedMs": 9000,
                      "videoRanges": [[0, 9]],
                      "startedAt": 1700000020000,
                      "endedAt": 1700000030000,
                      "createdAt": 1700000030000,
                      "updatedAt": 1700000030000
                    },
                    {
                      "id": "{{PdfProgressId}}",
                      "materialId": "{{PdfMaterialId}}",
                      "goalId": "{{GoalId}}",
                      "sessionId": null,
                      "kind": "pdf",
                      "totalWatchedMs": 0,
                      "pagesRead": [1, 2],
                      "pagesReadCounts": {"1": 1, "2": 1},
                      "startedAt": 1700000030000,
                      "endedAt": 1700000032000,
                      "createdAt": 1700000032000,
                      "updatedAt": 1700000032000
                    }
                  ],
                  "notes": [
                    {
                      "id": "{{NoteId}}",
                      "goalIds": ["{{GoalId}}"],
                      "kind": "text",
                      "title": "Ideas",
                      "text": "Repasar el modelo de amenazas.",
                      "metadata": {},
                      "sourceSessionId": null,
                      "source": "manual",
                      "createdAt": 1700000040000,
                      "updatedAt": 1700000040000
                    }
                  ],
                  "questions": [
                    {
                      "id": "{{QuestionId}}",
                      "goalId": "{{GoalId}}",
                      "prompt": "¿Qué principio limita los permisos?",
                      "answers": [
                        {
                          "id": "{{CorrectAnswerId}}",
                          "text": "Mínimo privilegio",
                          "isCorrect": true
                        },
                        {
                          "id": "{{IncorrectAnswerId}}",
                          "text": "Confianza implícita",
                          "isCorrect": false
                        }
                      ],
                      "reviewState": {
                        "timesSeen": 1,
                        "timesCorrect": 1,
                        "timesIncorrect": 0,
                        "lastSeenAt": 1700000050000,
                        "weight": 0.7
                      },
                      "createdAt": 1700000045000,
                      "updatedAt": 1700000050000
                    }
                  ],
                  "examAttempts": [
                    {
                      "id": "{{QuestionsAttemptId}}",
                      "goalId": "{{GoalId}}",
                      "kind": "questions",
                      "title": "Repaso rápido",
                      "startedAt": 1700000050000,
                      "pausedAt": null,
                      "endedAt": 1700000060000,
                      "totalPausedMs": 0,
                      "status": "completed",
                      "timeLimitMs": null,
                      "score": 1,
                      "maxScore": 1,
                      "notes": "",
                      "questionIds": ["{{QuestionId}}"],
                      "responses": [
                        {
                          "questionId": "{{QuestionId}}",
                          "chosenAnswerIds": ["{{CorrectAnswerId}}"],
                          "isCorrect": true,
                          "answeredAt": 1700000055000
                        }
                      ],
                      "createdAt": 1700000050000,
                      "updatedAt": 1700000060000
                    },
                    {
                      "id": "{{PdfAttemptId}}",
                      "goalId": "{{GoalId}}",
                      "kind": "pdf",
                      "title": "Simulacro PDF",
                      "startedAt": 1700000060000,
                      "pausedAt": null,
                      "endedAt": 1700000070000,
                      "totalPausedMs": 0,
                      "status": "graded",
                      "timeLimitMs": 60000,
                      "score": 7.5,
                      "maxScore": 10,
                      "notes": "Buen resultado.",
                      "pdfMaterialId": "{{PdfMaterialId}}",
                      "createdAt": 1700000060000,
                      "updatedAt": 1700000070000
                    }
                  ]
                }
                """
            )!
            .AsObject();
    }
}

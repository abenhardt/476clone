<?php

namespace Database\Factories;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Message>
 */
class MessageFactory extends Factory
{
    protected $model = Message::class;

    public function definition(): array
    {
        return [
            'conversation_id' => Conversation::factory(),
            'sender_id' => User::factory(),
            'body' => fake()->paragraph(),
            'idempotency_key' => Str::uuid()->toString(),
            'parent_message_id' => null, // null for root messages
            'reply_type' => null, // null for non-replies; 'reply' or 'reply_all' for replies
        ];
    }

    /** Message sent in a specific conversation. */
    public function inConversation(Conversation $conversation): static
    {
        return $this->state(fn () => ['conversation_id' => $conversation->id]);
    }

    /** Message sent by a specific user. */
    public function sentBy(User $user): static
    {
        return $this->state(fn () => ['sender_id' => $user->id]);
    }

    /** Message with specific body text. */
    public function withBody(string $body): static
    {
        return $this->state(fn () => ['body' => $body]);
    }

    /** Reply to a specific parent message. */
    public function replyTo(Message $parent): static
    {
        return $this->state(fn () => [
            'parent_message_id' => $parent->id,
            'reply_type' => 'reply',
        ]);
    }

    /** Reply-all to a specific parent message. */
    public function replyAllTo(Message $parent): static
    {
        return $this->state(fn () => [
            'parent_message_id' => $parent->id,
            'reply_type' => 'reply_all',
        ]);
    }
}

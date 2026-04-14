<?php

namespace App\Exceptions;

use Exception;

/**
 * Thrown when an admin attempts to change a field_key that is already referenced
 * by one or more submitted applications.
 *
 * Changing a field_key after answers exist is a breaking operation because the
 * answer storage in normalized tables (allergies, medications, etc.) references
 * the field_key as the stable identifier. Renaming it would orphan existing answers.
 */
class FormFieldKeyChangeException extends Exception
{
    public function __construct(string $fieldKey, int $applicationCount)
    {
        parent::__construct(
            "Cannot change field_key '{$fieldKey}': {$applicationCount} submitted application(s) reference this field. ".
            'Deactivate this field and create a new field with the desired key instead.'
        );
    }
}
